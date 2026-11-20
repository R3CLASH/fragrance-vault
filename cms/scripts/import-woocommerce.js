#!/usr/bin/env node
'use strict';
/**
 * Import your live WordPress/WooCommerce store into Strapi.
 *
 *   npm run import:woo                       # products, categories, brands, images and pages (public API, no keys)
 *   WC_KEY=ck_... WC_SECRET=cs_... npm run import:woo   # also exact stock levels, coupons and past orders
 *
 * Safe to run more than once: products are matched by their WooCommerce ID (or slug) and updated.
 * Options (env): WOO_URL (default https://fragrancevault.lk), IMPORT_ORDERS=false to skip orders.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const SITE = (process.env.WOO_URL || 'https://fragrancevault.lk').replace(/\/$/, '');
const KEY = process.env.WC_KEY, SECRET = process.env.WC_SECRET;
const GENDER_CATS = { 'for-him': 'for-him', 'for-her': 'for-her', unisex: 'unisex' };
const BRAND_CATS = { 'rasasi-hawas': 'Rasasi' }; // a category slug that means a brand + its display name

const log = (...a) => console.log('[import]', ...a);
const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stripHtml = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;/g, '’').replace(/\s+/g, ' ').trim();

async function get(url, auth) {
  const headers = { Accept: 'application/json', 'User-Agent': 'FragranceVault-Importer/1.0' };
  if (auth) headers.Authorization = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return { json: await res.json(), total: Number(res.headers.get('x-wp-totalpages') || res.headers.get('X-WP-TotalPages') || 1) };
}
async function all(base, auth) {
  const out = [];
  for (let page = 1; page < 200; page++) {
    const { json, total } = await get(`${base}${base.includes('?') ? '&' : '?'}per_page=100&page=${page}`, auth);
    out.push(...json);
    if (!json.length || page >= total) break;
  }
  return out;
}

async function uploadFromUrl(strapi, url, alt, cache) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  const name = decodeURIComponent(url.split('/').pop().split('?')[0]);
  const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });
  if (existing) { cache.set(url, existing.id); return existing.id; }
  const res = await fetch(url);
  if (!res.ok) { log('  could not download', url); return null; }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `fv-${Date.now()}-${name}`);
  fs.writeFileSync(tmp, buf);
  const mimetype = res.headers.get('content-type') || 'image/jpeg';
  const [file] = await strapi.plugin('upload').service('upload').upload({
    data: { fileInfo: { name, alternativeText: alt || name } },
    files: { filepath: tmp, originalFilename: name, mimetype, size: buf.length },
  });
  fs.unlinkSync(tmp);
  cache.set(url, file.id);
  return file.id;
}

async function upsert(strapi, uid, where, data, opts = {}) {
  const found = await strapi.documents(uid).findMany({ filters: where, limit: 1, ...(opts.status ? { status: 'draft' } : {}) });
  if (found[0]) return strapi.documents(uid).update({ documentId: found[0].documentId, data, ...(opts.status ? { status: opts.status } : {}) });
  return strapi.documents(uid).create({ data, ...(opts.status ? { status: opts.status } : {}) });
}

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const strapi = app;
  const images = new Map();
  try {
    // ---------- products ----------
    log(`Reading products from ${SITE} …`);
    const useRest = !!(KEY && SECRET);
    const products = useRest ? await all(`${SITE}/wp-json/wc/v3/products?status=publish`, true) : await all(`${SITE}/wp-json/wc/store/v1/products`);
    log(`Found ${products.length} products${useRest ? ' (with stock levels)' : ''}.`);

    const catIds = {}, brandIds = {};
    async function category(c) {
      if (catIds[c.slug]) return catIds[c.slug];
      const d = await upsert(strapi, 'api::category.category', { slug: c.slug }, { name: stripHtml(c.name), slug: c.slug });
      return (catIds[c.slug] = d.documentId);
    }
    async function brand(name) {
      const slug = slugify(name);
      if (brandIds[slug]) return brandIds[slug];
      const d = await upsert(strapi, 'api::brand.brand', { slug }, { name, slug });
      return (brandIds[slug] = d.documentId);
    }

    for (const [n, p] of products.entries()) {
      const cats = p.categories || [];
      const him = cats.some((c) => c.slug === 'for-him'), her = cats.some((c) => c.slug === 'for-her');
      const gender = cats.find((c) => GENDER_CATS[c.slug] === 'unisex') || (him && her) ? 'unisex' : him ? 'for-him' : her ? 'for-her' : 'unisex';
      const brandCat = cats.find((c) => !GENDER_CATS[c.slug]);
      const brandName = brandCat ? BRAND_CATS[brandCat.slug] || stripHtml(brandCat.name) : null;
      const minor = p.prices ? Math.pow(10, p.prices.currency_minor_unit || 0) : 1;
      const regular = useRest ? Number(p.regular_price || p.price || 0) : Number(p.prices.regular_price) / minor;
      const sale = useRest ? (p.sale_price ? Number(p.sale_price) : null) : (Number(p.prices.sale_price) / minor);
      const imgs = [];
      for (const im of p.images || []) { const id = await uploadFromUrl(strapi, im.src, im.alt || p.name, images); if (id) imgs.push(id); }
      const short = stripHtml(p.short_description).slice(0, 600);
      const data = {
        name: stripHtml(p.name), slug: p.slug, sku: p.sku || `FV-${p.id}`, wooId: p.id,
        // shop prices are the Koko price = WordPress price + 10% (bank transfer gets 10% off at checkout)
        price: Math.round(regular * 1.1), salePrice: sale && sale < regular ? Math.round(sale * 1.1) : null,
        saleStartsAt: p.date_on_sale_from || null, saleEndsAt: p.date_on_sale_to || null,
        shortDescription: short, description: p.description || p.short_description || '',
        gender, ...(imgs.length ? { images: imgs } : {}),
        categories: await Promise.all(cats.map(category)),
        brand: brandName ? await brand(brandName) : null,
        manageStock: useRest ? !!p.manage_stock : false,
        stock: useRest && p.manage_stock ? Number(p.stock_quantity || 0) : 0,
        inStock: useRest ? p.stock_status !== 'outofstock' : p.is_in_stock !== false,
        seo: { metaTitle: `${stripHtml(p.name)} | Fragrance Vault`.slice(0, 70), metaDescription: short.slice(0, 170) },
      };
      const byWoo = await strapi.documents('api::product.product').findMany({ filters: { $or: [{ wooId: p.id }, { slug: p.slug }] }, status: 'draft', limit: 1 });
      if (byWoo[0]) await strapi.documents('api::product.product').update({ documentId: byWoo[0].documentId, data, status: 'published' });
      else await strapi.documents('api::product.product').create({ data, status: 'published' });
      log(`  ${n + 1}/${products.length} ${data.name}`);
    }

    // ---------- pages ----------
    try {
      const pages = await all(`${SITE}/wp-json/wp/v2/pages?status=publish&_fields=slug,title,content,excerpt`);
      const skip = new Set(['cart', 'checkout', 'my-account', 'shop', 'home', 'vault', 'for-him', 'for-her', 'unisex']);
      for (const pg of pages) {
        if (skip.has(pg.slug)) continue;
        await upsert(strapi, 'api::page.page', { slug: pg.slug }, { title: stripHtml(pg.title.rendered), slug: pg.slug, content: pg.content.rendered }, { status: 'published' });
        log(`  page: ${pg.slug}`);
      }
    } catch (e) { log('Pages skipped:', e.message); }

    // ---------- coupons & orders (need WooCommerce REST keys) ----------
    if (useRest) {
      const coupons = await all(`${SITE}/wp-json/wc/v3/coupons`, true);
      for (const c of coupons) {
        await upsert(strapi, 'api::coupon.coupon', { code: c.code.toUpperCase() }, {
          code: c.code.toUpperCase(), description: stripHtml(c.description),
          type: c.discount_type === 'percent' ? 'percent' : 'fixed_cart', amount: Number(c.amount || 0),
          minimumSpend: c.minimum_amount ? Number(c.minimum_amount) : null, maximumDiscount: c.maximum_amount ? Number(c.maximum_amount) : null,
          usageLimit: c.usage_limit || null, usageLimitPerCustomer: c.usage_limit_per_user || null, usedCount: c.usage_count || 0,
          expiresAt: c.date_expires || null, enabled: true, excludeSaleItems: !!c.exclude_sale_items,
        });
      }
      log(`Imported ${coupons.length} coupons.`);
      if (process.env.IMPORT_ORDERS !== 'false') {
        const orders = await all(`${SITE}/wp-json/wc/v3/orders`, true);
        const map = { pending: 'pending_payment', 'on-hold': 'on_hold', processing: 'processing', completed: 'completed', cancelled: 'cancelled', refunded: 'refunded', failed: 'failed' };
        const addr = (a = {}) => ({ firstName: a.first_name || '-', lastName: a.last_name, company: a.company, address1: a.address_1 || '-', address2: a.address_2, city: a.city || '-', district: a.state, postcode: a.postcode, country: a.country, phone: a.phone, email: a.email });
        for (const o of orders) {
          const number = `WC-${o.number || o.id}`;
          const exists = await strapi.documents('api::order.order').count({ filters: { orderNumber: number } });
          if (exists) continue;
          await strapi.documents('api::order.order').create({ data: {
            orderNumber: number, orderStatus: map[o.status] || 'on_hold', paymentStatus: o.date_paid ? 'paid' : 'unpaid',
            customerEmail: (o.billing && o.billing.email) || 'unknown@fragrancevault.lk', customerPhone: o.billing && o.billing.phone,
            billing: addr(o.billing), shipping: addr(o.shipping && o.shipping.address_1 ? o.shipping : o.billing),
            items: (o.line_items || []).map((l) => ({ productName: l.name, sku: l.sku, unitPrice: Number(l.price), quantity: l.quantity, lineTotal: Number(l.total) })),
            subtotal: (o.line_items || []).reduce((n, l) => n + Number(l.subtotal), 0), discountTotal: Number(o.discount_total || 0),
            shippingTotal: Number(o.shipping_total || 0), paymentFee: (o.fee_lines || []).reduce((n, f) => n + Number(f.total), 0), total: Number(o.total),
            currency: o.currency, couponCode: (o.coupon_lines || []).map((c) => c.code).join(', ') || null,
            paymentMethodName: o.payment_method_title, shippingMethodName: (o.shipping_lines || []).map((s) => s.method_title).join(', ') || null,
            transactionId: o.transaction_id || null, paidAt: o.date_paid || null, customerNote: o.customer_note || null,
            stockReduced: false, accessToken: require('crypto').randomBytes(18).toString('hex'),
            statusHistory: [{ status: map[o.status] || 'on_hold', note: `Imported from WooCommerce (order #${o.number || o.id}, placed ${o.date_created}).`, at: new Date(), by: 'import' }],
          } });
        }
        log(`Imported ${orders.length} past orders.`);
      }
    } else {
      log('Tip: add WC_KEY and WC_SECRET (WooCommerce → Settings → Advanced → REST API, read access) to also import stock levels, coupons and past orders.');
    }
    log('Done.');
  } finally {
    await app.destroy();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
