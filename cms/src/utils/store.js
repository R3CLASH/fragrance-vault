'use strict';
/**
 * Store engine: the single source of truth for prices, stock, coupons, shipping and payment fees.
 * The storefront never sends prices; it only sends product IDs and quantities.
 */
const crypto = require('crypto');

const PRODUCT = 'api::product.product';
const ORDER = 'api::order.order';
const COUPON = 'api::coupon.coupon';
const PAYMENT = 'api::payment-method.payment-method';
const SHIPPING = 'api::shipping-method.shipping-method';

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

class StoreError extends Error {
  constructor(message, status = 400, details) { super(message); this.status = status; this.details = details; }
}

/** The price a customer pays right now for a product (or one of its variants). */
function unitPrice(product, variant, now = new Date()) {
  const base = variant ? num(variant.price) : num(product.price);
  const sale = variant ? num(variant.salePrice) : num(product.salePrice);
  const starts = product.saleStartsAt ? new Date(product.saleStartsAt) : null;
  const ends = product.saleEndsAt ? new Date(product.saleEndsAt) : null;
  const saleLive = sale !== null && sale > 0 && sale < base && (!starts || starts <= now) && (!ends || ends >= now);
  return { price: round(saleLive ? sale : base), regular: round(base), onSale: saleLive };
}

/** How many units can still be sold. null = unlimited. */
function available(product, variant) {
  if (!product.manageStock) return product.inStock === false ? 0 : null;
  if (variant && num(variant.stock) !== null) return Math.max(0, num(variant.stock));
  return Math.max(0, num(product.stock) || 0);
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new StoreError('Your cart is empty.');
  if (items.length > 50) throw new StoreError('Too many different items in one order.');
  return items.map((i) => {
    const quantity = Math.floor(Number(i && i.quantity));
    if (!i || typeof i.id !== 'string' || !i.id || !(quantity >= 1 && quantity <= 99)) throw new StoreError('A cart item is invalid.');
    return { id: i.id, variant: i.variant ? String(i.variant).slice(0, 120) : null, quantity };
  });
}

async function loadProducts(strapi, ids) {
  const rows = await strapi.documents(PRODUCT).findMany({
    filters: { documentId: { $in: [...new Set(ids)] } },
    status: 'published',
    populate: { variants: true, images: true },
    limit: 100,
  });
  return new Map(rows.map((p) => [p.documentId, p]));
}

async function findCoupon(strapi, code) {
  if (!code) return null;
  const rows = await strapi.documents(COUPON).findMany({
    filters: { code: { $eqi: String(code).trim() } },
    populate: { products: { fields: ['documentId'] } },
    limit: 1,
  });
  return rows[0] || null;
}

async function couponUsesBy(strapi, code, email) {
  if (!email) return 0;
  return strapi.documents(ORDER).count({
    filters: { couponCode: { $eqi: code }, customerEmail: { $eqi: email }, orderStatus: { $notIn: ['cancelled', 'failed'] } },
  });
}

/**
 * Price a cart. Returns every number the checkout needs, plus per-line problems.
 * input: { items: [{ id, variant, quantity }], couponCode, shippingMethodId, paymentMethodId, email }
 */
async function quote(strapi, input = {}) {
  const items = validateItems(input.items);
  const products = await loadProducts(strapi, items.map((i) => i.id));
  const now = new Date();
  const problems = [];
  const lines = items.map((item) => {
    const p = products.get(item.id);
    if (!p) { problems.push({ id: item.id, message: 'This product is no longer available.' }); return null; }
    const variant = item.variant ? (p.variants || []).find((v) => v.label === item.variant) : null;
    if (item.variant && !variant) { problems.push({ id: item.id, message: `${p.name}: that option is no longer available.` }); return null; }
    if (!item.variant && (p.variants || []).length) { problems.push({ id: item.id, message: `${p.name}: please choose an option.` }); return null; }
    const left = available(p, variant);
    if (left !== null && left < item.quantity) {
      problems.push({ id: item.id, variant: item.variant, message: left === 0 ? `${p.name} is out of stock.` : `Only ${left} of ${p.name} left.`, available: left });
    }
    const pr = unitPrice(p, variant, now);
    return {
      id: p.documentId, dbId: p.id, name: p.name, slug: p.slug, variant: variant ? variant.label : null,
      sku: (variant && variant.sku) || p.sku || null, unitPrice: pr.price, regularPrice: pr.regular, onSale: pr.onSale,
      quantity: item.quantity, lineTotal: round(pr.price * item.quantity), image: (p.images && p.images[0] && p.images[0].url) || null,
    };
  }).filter(Boolean);

  const subtotal = round(lines.reduce((n, l) => n + l.lineTotal, 0));

  // coupon
  let discount = 0, freeShipping = false, coupon = null;
  if (input.couponCode) {
    const c = await findCoupon(strapi, input.couponCode);
    const fail = (message) => { coupon = { code: String(input.couponCode).trim().toUpperCase(), valid: false, message }; };
    if (!c || !c.enabled) fail('This coupon code is not valid.');
    else if (c.startsAt && new Date(c.startsAt) > now) fail('This coupon is not active yet.');
    else if (c.expiresAt && new Date(c.expiresAt) < now) fail('This coupon has expired.');
    else if (c.usageLimit && (c.usedCount || 0) >= c.usageLimit) fail('This coupon has reached its usage limit.');
    else if (c.minimumSpend && subtotal < num(c.minimumSpend)) fail(`Spend at least Rs. ${num(c.minimumSpend).toLocaleString('en-LK')} to use this coupon.`);
    else if (c.usageLimitPerCustomer && input.email && (await couponUsesBy(strapi, c.code, input.email)) >= c.usageLimitPerCustomer) fail('You have already used this coupon.');
    else {
      const allowed = new Set((c.products || []).map((p) => p.documentId));
      const eligible = lines.filter((l) => (!allowed.size || allowed.has(l.id)) && !(c.excludeSaleItems && l.onSale));
      const base = round(eligible.reduce((n, l) => n + l.lineTotal, 0));
      if (c.type === 'free_shipping') freeShipping = true;
      else if (!base) { fail('This coupon does not apply to the items in your cart.'); }
      else if (c.type === 'percent') discount = round((base * num(c.amount)) / 100);
      else discount = round(Math.min(num(c.amount) || 0, base));
      if (c.maximumDiscount && discount > num(c.maximumDiscount)) discount = round(num(c.maximumDiscount));
      if (!coupon) coupon = { code: c.code, valid: true, type: c.type, message: c.description || 'Coupon applied.' };
    }
  }

  // shipping
  const shipRows = await strapi.documents(SHIPPING).findMany({ filters: { enabled: true }, sort: 'sortOrder:asc', limit: 50 });
  const shippingMethods = shipRows.map((s) => {
    const free = freeShipping || (num(s.freeOver) !== null && subtotal - discount >= num(s.freeOver));
    return { id: s.documentId, name: s.name, description: s.description, estimatedDays: s.estimatedDays, cost: free ? 0 : round(s.rate) };
  });
  const ship = shippingMethods.find((s) => s.id === input.shippingMethodId) || shippingMethods[0] || null;
  const shipping = ship ? ship.cost : 0;

  // payment
  const payRows = await strapi.documents(PAYMENT).findMany({ filters: { enabled: true }, sort: 'sortOrder:asc', limit: 50 });
  const beforeFee = round(subtotal - discount + shipping);
  const paymentMethods = payRows
    .filter((m) => (num(m.minimumOrder) === null || beforeFee >= num(m.minimumOrder)) && (num(m.maximumOrder) === null || beforeFee <= num(m.maximumOrder)))
    .map((m) => {
      const fee = round((beforeFee * (num(m.feePercent) || 0)) / 100 + (num(m.feeFixed) || 0));
      return { id: m.documentId, name: m.name, type: m.type, description: m.description, fee, total: round(beforeFee + fee) };
    });
  const pay = paymentMethods.find((m) => m.id === input.paymentMethodId) || paymentMethods[0] || null;
  const fee = pay ? pay.fee : 0;

  return {
    currency: 'LKR', lines, problems, coupon,
    subtotal, discount, shipping, fee, total: round(beforeFee + fee),
    shippingMethodId: ship ? ship.id : null, paymentMethodId: pay ? pay.id : null,
    shippingMethods, paymentMethods,
  };
}

// ---------- stock ----------
async function changeStock(strapi, line, delta) {
  // Draft and published copies of a product are separate rows: keep both in step.
  const rows = await strapi.db.query(PRODUCT).findMany({ where: { documentId: line.id }, populate: { variants: true } });
  for (const row of rows) {
    if (!row.manageStock) continue;
    const v = line.variant ? (row.variants || []).find((x) => x.label === line.variant) : null;
    if (v && num(v.stock) !== null) {
      await strapi.db.query('product.variant').update({ where: { id: v.id }, data: { stock: Math.max(0, num(v.stock) + delta) } });
    } else {
      await strapi.db.query(PRODUCT).update({ where: { id: row.id }, data: { stock: Math.max(0, (num(row.stock) || 0) + delta) } });
    }
  }
}

async function adjustOrderStock(strapi, order, direction) {
  for (const it of order.items || []) {
    const id = it.productId || (it.product && it.product.documentId);
    if (id) await changeStock(strapi, { id, variant: it.variant || null }, direction * it.quantity);
  }
}

// ---------- order placement ----------
const STATUS_FOR = { bank_transfer: 'on_hold', cash_on_delivery: 'processing', payhere: 'pending_payment', koko: 'on_hold', payzy: 'on_hold', manual: 'on_hold' };
const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function address(a = {}) {
  return {
    firstName: clean(a.firstName, 80), lastName: clean(a.lastName, 80), company: clean(a.company, 120),
    address1: clean(a.address1), address2: clean(a.address2), city: clean(a.city, 80), district: clean(a.district, 80),
    postcode: clean(a.postcode, 20), country: clean(a.country, 60) || 'Sri Lanka', phone: clean(a.phone, 30), email: clean(a.email, 120),
  };
}

function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `FV-${ymd}-${crypto.randomInt(1000, 9999)}${crypto.randomInt(10, 99)}`;
}

async function placeOrder(strapi, input = {}, meta = {}) {
  const email = clean(input.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError('Please enter a valid email address.');
  const billing = address({ ...input.billing, email });
  const missing = ['firstName', 'address1', 'city', 'phone'].filter((k) => !billing[k]);
  if (missing.length) throw new StoreError('Please complete your delivery details.', 400, { missing });
  const shipping = input.shipToDifferentAddress ? address(input.shipping) : { ...billing };

  const q = await quote(strapi, { ...input, email });
  if (q.problems.length) throw new StoreError(q.problems.map((p) => p.message).join(' '), 409, { problems: q.problems });
  if (!q.lines.length) throw new StoreError('Your cart is empty.');
  if (input.couponCode && q.coupon && !q.coupon.valid) throw new StoreError(q.coupon.message, 409);
  const pay = q.paymentMethods.find((m) => m.id === input.paymentMethodId);
  if (!pay) throw new StoreError('Please choose a payment method.');
  const ship = q.shippingMethods.find((s) => s.id === input.shippingMethodId) || q.shippingMethods[0];
  if (!ship && q.shippingMethods.length) throw new StoreError('Please choose a delivery method.');

  const status = STATUS_FOR[pay.type] || 'on_hold';
  const accessToken = crypto.randomBytes(18).toString('hex');
  let number = orderNumber();
  for (let i = 0; i < 5 && (await strapi.documents(ORDER).count({ filters: { orderNumber: number } })); i++) number = orderNumber();

  const order = await strapi.db.transaction(async () => {
    // re-check stock inside the transaction, then reduce it
    const fresh = await quote(strapi, { ...input, email });
    if (fresh.problems.length) throw new StoreError(fresh.problems.map((p) => p.message).join(' '), 409, { problems: fresh.problems });
    for (const l of q.lines) await changeStock(strapi, l, -l.quantity);
    if (q.coupon && q.coupon.valid) {
      const c = await findCoupon(strapi, q.coupon.code);
      if (c) await strapi.db.query(COUPON).updateMany({ where: { documentId: c.documentId }, data: { usedCount: (c.usedCount || 0) + 1 } });
    }
    return strapi.documents(ORDER).create({
      data: {
        orderNumber: number, orderStatus: status, paymentStatus: 'unpaid', customerEmail: email, customerPhone: billing.phone,
        billing, shipping,
        items: q.lines.map((l) => ({ product: l.id, productId: l.id, productName: l.name, variant: l.variant, sku: l.sku, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal, image: l.image })),
        subtotal: q.subtotal, discountTotal: q.discount, shippingTotal: q.shipping, paymentFee: pay.fee, total: pay.total, currency: 'LKR',
        couponCode: q.coupon && q.coupon.valid ? q.coupon.code : null,
        paymentMethodName: pay.name, paymentMethodType: pay.type, shippingMethodName: ship ? ship.name : null,
        customerNote: clean(input.note, 1000), stockReduced: true, accessToken, ipAddress: clean(meta.ip, 60),
        statusHistory: [{ status, note: `Order placed. Payment: ${pay.name}.`, at: new Date(), by: 'customer' }],
      },
    });
  });

  sendOrderEmails(strapi, order, 'placed').catch((e) => strapi.log.warn(`Order email failed: ${e.message}`));
  return { order, payment: await paymentStep(strapi, order, pay.id) };
}

/** What the customer must do next to pay. */
async function paymentStep(strapi, order, paymentMethodId) {
  const m = await strapi.documents(PAYMENT).findOne({ documentId: paymentMethodId });
  const step = { type: m.type, name: m.name, instructions: m.instructions || null };
  if (m.type === 'payhere') step.redirect = payhereForm(strapi, order, m);
  return step;
}

// ---------- PayHere (Sri Lanka card / wallet gateway) ----------
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();

function payhereForm(strapi, order, method) {
  const cfg = method.config || {};
  if (!cfg.merchantId || !cfg.merchantSecret) return null;
  const site = (process.env.STOREFRONT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const api = (process.env.PUBLIC_URL || 'http://localhost:1337').replace(/\/$/, '');
  const amount = Number(order.total).toFixed(2);
  const b = order.billing || {};
  const fields = {
    merchant_id: cfg.merchantId,
    return_url: `${site}/order/${order.orderNumber}?token=${order.accessToken}`,
    cancel_url: `${site}/checkout?cancelled=${order.orderNumber}`,
    notify_url: `${api}/api/payments/payhere/notify`,
    order_id: order.orderNumber,
    items: `Fragrance Vault order ${order.orderNumber}`,
    currency: order.currency || 'LKR',
    amount,
    first_name: b.firstName || '', last_name: b.lastName || '', email: order.customerEmail, phone: b.phone || '',
    address: [b.address1, b.address2].filter(Boolean).join(', '), city: b.city || '', country: b.country || 'Sri Lanka',
    hash: md5(cfg.merchantId + order.orderNumber + amount + (order.currency || 'LKR') + md5(cfg.merchantSecret)),
  };
  return { url: method.testMode ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout', fields };
}

const sameSig = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function payhereNotify(strapi, body = {}) {
  // Check PayHere's signature before anything else, so this public endpoint reveals nothing about which orders exist.
  const methods = await strapi.documents(PAYMENT).findMany({ filters: { type: 'payhere' }, limit: 1 });
  const cfg = (methods[0] && methods[0].config) || {};
  const expected = md5(String(cfg.merchantId) + body.order_id + body.payhere_amount + body.payhere_currency + body.status_code + md5(String(cfg.merchantSecret)));
  if (!cfg.merchantSecret || !sameSig(expected, String(body.md5sig || '').toUpperCase())) throw new StoreError('Signature mismatch', 401);
  const order = await findOrder(strapi, { orderNumber: body.order_id });
  if (!order) throw new StoreError('Unknown order', 404);
  if (String(body.payhere_currency || '').toUpperCase() !== String(order.currency || 'LKR').toUpperCase()) throw new StoreError('Currency mismatch', 400);
  if (Number(body.payhere_amount) + 0.001 < Number(order.total)) throw new StoreError('Amount mismatch', 400);
  const code = Number(body.status_code);
  if (code === 2 && order.paymentStatus !== 'paid') {
    await updateOrder(strapi, order, { orderStatus: 'processing', paymentStatus: 'paid', paidAt: new Date(), transactionId: String(body.payment_id || '') }, 'Payment received through PayHere.', 'payhere');
  } else if (code === -2 || code === -1) {
    await updateOrder(strapi, order, { orderStatus: code === -1 ? 'cancelled' : 'failed', paymentStatus: 'failed' }, `PayHere reported the payment as ${code === -1 ? 'cancelled' : 'failed'}.`, 'payhere');
  }
  return { ok: true };
}

// ---------- order lookups & updates ----------
async function findOrder(strapi, { orderNumber, token, email }) {
  if (!orderNumber) return null;
  const rows = await strapi.documents(ORDER).findMany({
    filters: { orderNumber: String(orderNumber).trim().toUpperCase() },
    populate: { billing: true, shipping: true, items: { populate: { product: { fields: ['documentId', 'slug'] } } }, statusHistory: true },
    limit: 1,
  });
  const o = rows[0];
  if (!o) return null;
  if (token !== undefined && token !== o.accessToken) return null;
  if (email !== undefined && String(email).trim().toLowerCase() !== String(o.customerEmail).toLowerCase()) return null;
  return o;
}

function publicOrder(o) {
  return {
    orderNumber: o.orderNumber, status: o.orderStatus, paymentStatus: o.paymentStatus, createdAt: o.createdAt,
    email: o.customerEmail, billing: o.billing, shippingAddress: o.shipping,
    items: (o.items || []).map((i) => ({ name: i.productName, variant: i.variant, quantity: i.quantity, unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal), image: i.image, slug: i.product && i.product.slug })),
    subtotal: Number(o.subtotal), discount: Number(o.discountTotal), shipping: Number(o.shippingTotal), fee: Number(o.paymentFee), total: Number(o.total),
    couponCode: o.couponCode, paymentMethod: o.paymentMethodName, paymentType: o.paymentMethodType, shippingMethod: o.shippingMethodName,
    courier: o.courier, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl,
    history: (o.statusHistory || []).map((h) => ({ status: h.status, note: h.note, at: h.at })),
  };
}

const HISTORY = (o) => (o.statusHistory || []).map((h) => ({ status: h.status, note: h.note, at: h.at, by: h.by }));

async function updateOrder(strapi, order, data, note, by = 'system') {
  return strapi.documents(ORDER).update({
    documentId: order.documentId,
    data: { ...data, statusHistory: [...HISTORY(order), { status: data.orderStatus || order.orderStatus, note, at: new Date(), by }] },
  });
}

// ---------- email ----------
const LABEL = { pending_payment: 'Pending payment', on_hold: 'On hold', processing: 'Processing', shipped: 'Shipped', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Refunded', failed: 'Failed' };

async function sendOrderEmails(strapi, order, event) {
  const email = strapi.plugin('email') && strapi.plugin('email').service('email');
  if (!email || !process.env.SMTP_HOST) return;
  const g = (await strapi.documents('api::global.global').findFirst()) || {};
  const site = (process.env.STOREFRONT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const full = order.items ? order : await findOrder(strapi, { orderNumber: order.orderNumber });
  const rows = (full.items || []).map((i) => `<tr><td style="padding:6px 0">${esc(i.productName)}${i.variant ? ` (${esc(i.variant)})` : ''} × ${i.quantity}</td><td style="text-align:right">Rs. ${Number(i.lineTotal).toLocaleString('en-LK')}</td></tr>`).join('');
  const link = `${site}/order/${full.orderNumber}?token=${full.accessToken}`;
  const heading = event === 'placed' ? 'Thank you, your order is in the vault.' : `Your order is now: ${LABEL[full.orderStatus] || full.orderStatus}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222"><h2 style="font-family:Georgia,serif">${heading}</h2>
<p>Order <b>${full.orderNumber}</b></p><table style="width:100%;border-collapse:collapse">${rows}
<tr><td style="padding-top:10px;border-top:1px solid #ddd">Total</td><td style="text-align:right;padding-top:10px;border-top:1px solid #ddd"><b>Rs. ${Number(full.total).toLocaleString('en-LK')}</b></td></tr></table>
${full.trackingNumber ? `<p>Tracking: ${esc(full.courier || '')} ${esc(full.trackingNumber)}</p>` : ''}<p><a href="${link}">View your order</a></p></div>`;
  const from = g.orderEmailFrom || process.env.SMTP_FROM;
  await email.send({ to: full.customerEmail, from, subject: `${g.siteName || 'Fragrance Vault'} order ${full.orderNumber}: ${event === 'placed' ? 'received' : LABEL[full.orderStatus]}`, html });
  if (event === 'placed' && g.orderNotificationEmail) {
    await email.send({ to: g.orderNotificationEmail, from, subject: `New order ${full.orderNumber} (Rs. ${Number(full.total).toLocaleString('en-LK')})`, html });
  }
}
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

module.exports = { StoreError, quote, placeOrder, findOrder, publicOrder, payhereNotify, paymentStep, adjustOrderStock, sendOrderEmails, unitPrice, round };
