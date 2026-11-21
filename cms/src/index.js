'use strict';
const fs = require('fs');
const path = require('path');
const store = require('./utils/store');

const ORDER = 'api::order.order';
const RELEASE_STOCK = ['cancelled', 'failed', 'refunded'];
const EMAIL_ON = ['processing', 'shipped', 'completed', 'cancelled', 'refunded'];

const PUBLIC_READ = [
  'api::product.product.find', 'api::product.product.findOne',
  'api::brand.brand.find', 'api::brand.brand.findOne',
  'api::category.category.find', 'api::category.category.findOne',
  'api::page.page.find', 'api::page.page.findOne',
  'api::global.global.find', 'api::homepage.homepage.find',
  'api::payment-method.payment-method.find', 'api::shipping-method.shipping-method.find',
];

module.exports = {
  register({ strapi }) {
    // WooCommerce-style order handling when an order's status changes (admin panel or payment callbacks):
    // stock goes back on cancel/fail/refund, comes off again if re-opened, history is logged and the customer is emailed.
    strapi.documents.use(async (context, next) => {
      if (context.uid !== ORDER || context.action !== 'update') return next();
      const before = await strapi.documents(ORDER).findOne({
        documentId: context.params.documentId,
        populate: { items: { populate: { product: { fields: ['documentId'] } } }, statusHistory: true },
      });
      const result = await next();
      const status = context.params.data && context.params.data.orderStatus;
      if (!before || !status || status === before.orderStatus) return result;
      try {
        const extra = {};
        if (RELEASE_STOCK.includes(status) && before.stockReduced) { await store.adjustOrderStock(strapi, before, +1); extra.stockReduced = false; }
        if (!RELEASE_STOCK.includes(status) && !before.stockReduced) { await store.adjustOrderStock(strapi, before, -1); extra.stockReduced = true; }
        if (status === 'refunded') extra.paymentStatus = 'refunded';
        if (status === 'completed' && before.paymentStatus === 'unpaid') { extra.paymentStatus = 'paid'; extra.paidAt = new Date(); }
        const after = await strapi.documents(ORDER).findOne({ documentId: context.params.documentId, populate: { statusHistory: true } });
        const hist = (after.statusHistory || []).map((h) => ({ status: h.status, note: h.note, at: h.at, by: h.by }));
        if (!hist.length || hist[hist.length - 1].status !== status) hist.push({ status, note: `Status changed from ${before.orderStatus} to ${status}.`, at: new Date(), by: 'admin' });
        await strapi.db.transaction(() => strapi.documents(ORDER).update({ documentId: context.params.documentId, data: { ...extra, statusHistory: hist } }));
        if (EMAIL_ON.includes(status)) store.sendOrderEmails(strapi, { ...after, ...extra, orderStatus: status }, 'status').catch((e) => strapi.log.warn(`Status email failed: ${e.message}`));
      } catch (e) {
        strapi.log.error(`Order status follow-up failed: ${e.message}`);
      }
      return result;
    });
  },

  async bootstrap({ strapi }) {
    await grantPublicRead(strapi);
    await lockPublicAuth(strapi);
    await fillBankDetails(strapi);
    await adminListViews(strapi);
    if (process.env.SEED_ON_EMPTY !== 'false') await seed(strapi);
    await repriceForKoko(strapi);
    await announceBankOffer(strapi);
    await logKokoStatus(strapi);
  },
};

async function grantPublicRead(strapi) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (!role) return;
  for (const action of PUBLIC_READ) {
    const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({ where: { action, role: role.id } });
    if (!exists) await strapi.db.query('plugin::users-permissions.permission').create({ data: { action, role: role.id } });
  }
}

// The shop has no customer accounts (orders are guest checkouts), so nobody may sign up or use the
// end-user auth flows. Admin logins are separate and unaffected. Runs on every start, so it stays off.
const PUBLIC_AUTH_OFF = [
  'plugin::users-permissions.auth.register', 'plugin::users-permissions.auth.connect', 'plugin::users-permissions.auth.callback',
  'plugin::users-permissions.auth.forgotPassword', 'plugin::users-permissions.auth.resetPassword',
  'plugin::users-permissions.auth.emailConfirmation', 'plugin::users-permissions.auth.sendEmailConfirmation',
];
async function lockPublicAuth(strapi) {
  const ups = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const adv = (await ups.get({ key: 'advanced' })) || {};
  if (adv.allow_register !== false) await ups.set({ key: 'advanced', value: { ...adv, allow_register: false } });
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (role) await strapi.db.query('plugin::users-permissions.permission').deleteMany({ where: { role: role.id, action: { $in: PUBLIC_AUTH_OFF } } });
}

// The bank transfer method was first created with placeholder text ([YOUR BANK] etc.). Fill in the real
// account once; if the text has already been edited in the admin panel, it is left exactly as it is.
const BANK_INSTRUCTIONS = "Transfer the order total to:\n\n**Account name:** Dinuka Gunawardana\n**Bank:** Sampath Bank\n**Branch:** Piliyandala\n**Account number:** 101955248514\n\nUse your order number as the payment reference and send the slip to us on WhatsApp.";
async function fillBankDetails(strapi) {
  const rows = await strapi.documents('api::payment-method.payment-method').findMany({ filters: { type: 'bank_transfer' }, limit: 10 });
  for (const m of rows) {
    if (!/\[(YOUR BANK|ACCOUNT NAME|ACCOUNT NUMBER|BRANCH)\]/.test(m.instructions || '')) continue;
    await strapi.documents('api::payment-method.payment-method').update({ documentId: m.documentId, data: { instructions: BANK_INSTRUCTIONS } });
    strapi.log.info('[setup] Bank transfer details filled in (replaced placeholder text).');
  }
}

const LABELS = { orderNumber: 'Order', orderStatus: 'Status', paymentStatus: 'Payment', total: 'Total (LKR)', customerEmail: 'Customer', createdAt: 'Date', salePrice: 'Sale price', feePercent: 'Fee %', freeOver: 'Free over (LKR)', usedCount: 'Times used', expiresAt: 'Expires', sortOrder: 'Order in list' };

// WooCommerce-like list screens in the admin panel (only set once, so your own changes in the panel are kept)
async function adminListViews(strapi) {
  const views = {
    'api::order.order': { list: ['orderNumber', 'orderStatus', 'paymentStatus', 'total', 'customerEmail', 'createdAt'], main: 'orderNumber', sort: 'createdAt', order: 'DESC' },
    'api::product.product': { list: ['name', 'price', 'salePrice', 'stock', 'brand', 'featured'], main: 'name', sort: 'name', order: 'ASC' },
    'api::coupon.coupon': { list: ['code', 'type', 'amount', 'usedCount', 'expiresAt', 'enabled'], main: 'code', sort: 'code', order: 'ASC' },
    'api::payment-method.payment-method': { list: ['name', 'type', 'feePercent', 'enabled', 'sortOrder'], main: 'name', sort: 'sortOrder', order: 'ASC' },
    'api::shipping-method.shipping-method': { list: ['name', 'rate', 'freeOver', 'enabled'], main: 'name', sort: 'sortOrder', order: 'ASC' },
  };
  try {
    const flag = await strapi.store.get({ type: 'plugin', name: 'fragrance-vault', key: 'admin-views-v2' });
    if (flag) return;
    const svc = strapi.plugin('content-manager').service('content-types');
    for (const [uid, v] of Object.entries(views)) {
      const ct = strapi.contentType(uid);
      const conf = await svc.findConfiguration(ct);
      const metadatas = { ...conf.metadatas };
      for (const f of Object.keys(metadatas)) {
        const nice = LABELS[f] || f.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
        metadatas[f] = { ...metadatas[f], list: { ...metadatas[f].list, label: nice }, edit: { ...metadatas[f].edit, label: nice } };
      }
      await svc.updateConfiguration(ct, {
        ...conf,
        metadatas,
        settings: { ...conf.settings, mainField: v.main, defaultSortBy: v.sort, defaultSortOrder: v.order, pageSize: 20 },
        layouts: { ...conf.layouts, list: v.list },
      });
    }
    await strapi.store.set({ type: 'plugin', name: 'fragrance-vault', key: 'admin-views-v2', value: true });
  } catch (e) {
    strapi.log.warn(`Could not set admin list views: ${e.message}`);
  }
}

async function upload(strapi, file, alt) {
  const full = path.join(__dirname, '..', 'seed', 'images', file);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  const ext = path.extname(file).slice(1);
  const [up] = await strapi.plugin('upload').service('upload').upload({
    data: { fileInfo: { alternativeText: alt, name: file } },
    files: { filepath: full, originalFilename: file, mimetype: ext === 'png' ? 'image/png' : `image/${ext}`, size: stat.size },
  });
  return up;
}

/**
 * November 2026 pricing change, applied ONCE (a saved flag stops it ever running again):
 * the shown price becomes the Koko price = previous price + 10%, and offers replace payment fees.
 *  - every product price / sale price / variant price × 1.10 (rounded to the rupee)
 *  - Bank transfer: 10% off the products (feePercent -10)
 *  - Koko and Payzy: no extra fee any more (it is now inside the shown price)
 *  - Credit / debit card: hidden for now (enabled = false)
 */
const PRICE_FACTOR = 1.1;
async function repriceForKoko(strapi) {
  const flags = strapi.store({ type: 'plugin', name: 'fv-setup' });
  if (await flags.get({ key: 'reprice-koko-2026-11' })) return;
  const up = (v) => (v === null || v === undefined || v === '' ? v : Math.round(Number(v) * PRICE_FACTOR));
  let products = 0, variants = 0;
  await strapi.db.transaction(async () => {
    // all rows, draft and published copies alike, so both stay in step
    for (const r of await strapi.db.query('api::product.product').findMany({ select: ['id', 'price', 'salePrice'] })) {
      await strapi.db.query('api::product.product').update({ where: { id: r.id }, data: { price: up(r.price), salePrice: up(r.salePrice) } });
      products++;
    }
    for (const r of await strapi.db.query('product.variant').findMany({ select: ['id', 'price', 'salePrice'] })) {
      await strapi.db.query('product.variant').update({ where: { id: r.id }, data: { price: up(r.price), salePrice: up(r.salePrice) } });
      variants++;
    }
    const pm = 'api::payment-method.payment-method';
    await strapi.db.query(pm).updateMany({ where: { type: 'bank_transfer' }, data: { feePercent: -10, feeFixed: 0 } });
    await strapi.db.query(pm).updateMany({ where: { type: { $in: ['koko', 'payzy'] } }, data: { feePercent: 0, feeFixed: 0 } });
    await strapi.db.query(pm).updateMany({ where: { type: 'payhere' }, data: { enabled: false } });
  });
  await flags.set({ key: 'reprice-koko-2026-11', value: { at: new Date().toISOString(), products, variants } });
  strapi.log.info(`[setup] Prices raised 10% (Koko price) on ${products} product rows and ${variants} variants; bank transfer now 10% off, card hidden.`);
}

// Top-of-site announcement for the bank transfer offer. Set ONCE, and only if the announcement is
// empty: after that it belongs to the admin panel (Global → announcement), and clearing it keeps it cleared.
async function announceBankOffer(strapi) {
  const flags = strapi.store({ type: 'plugin', name: 'fv-setup' });
  if (await flags.get({ key: 'announce-bank-offer-2026-11' })) return;
  const g = await strapi.documents('api::global.global').findFirst();
  if (g && !String(g.announcement || '').trim()) {
    await strapi.documents('api::global.global').update({ documentId: g.documentId, data: { announcement: 'Pay by bank transfer and get 10% off every perfume' } });
    strapi.log.info('[setup] Announcement bar set to the bank transfer offer.');
  }
  await flags.set({ key: 'announce-bank-offer-2026-11', value: { at: new Date().toISOString() } });
}

// Say in the Railway logs where Koko's keys come from and whether they work (never prints a key).
async function logKokoStatus(strapi) {
  const rows = await strapi.documents('api::payment-method.payment-method').findMany({ filters: { type: 'koko' }, limit: 1 });
  if (rows[0]) strapi.log.info(require('./utils/koko').describe(rows[0]));
}

async function seed(strapi) {
  if ((await strapi.documents('api::product.product').count()) > 0) return;
  const file = path.join(__dirname, '..', 'seed', 'data.json');
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  strapi.log.info('Seeding the store with the Fragrance Vault catalogue…');

  const cats = {};
  for (const [i, name] of data.categories.entries()) {
    const c = await strapi.documents('api::category.category').create({ data: { name, slug: slugify(name), sortOrder: i } });
    cats[name] = c.documentId;
  }
  const brands = {};
  for (const name of [...new Set(data.products.map((p) => p.brand).filter(Boolean))]) {
    const b = await strapi.documents('api::brand.brand').create({ data: { name, slug: slugify(name) } });
    brands[name] = b.documentId;
  }
  const bySlug = {};
  for (const p of data.products) {
    const img = p.image ? await upload(strapi, p.image, `${p.name} bottle`) : null;
    const doc = await strapi.documents('api::product.product').create({
      data: {
        name: p.name, slug: p.slug, sku: `FV-${p.wooId}`, price: p.price, salePrice: p.salePrice, shortDescription: p.shortDescription,
        description: p.shortDescription, gender: p.gender, concentration: p.concentration, topNotes: p.topNotes, heartNotes: p.heartNotes,
        baseNotes: p.baseNotes, accent: p.accent, featured: !!p.featured, manageStock: true, stock: 10, inStock: true, wooId: p.wooId,
        brand: p.brand ? brands[p.brand] : null,
        categories: p.collections.filter((c) => cats[c]).map((c) => cats[c]),
        images: img ? [img.id] : [],
        seo: { metaTitle: `${p.name} | Fragrance Vault`.slice(0, 70), metaDescription: p.shortDescription.slice(0, 170) },
      },
      status: 'published',
    });
    bySlug[p.slug] = doc;
  }
  for (const s of data.shipping) await strapi.documents('api::shipping-method.shipping-method').create({ data: { ...s, enabled: true } });
  for (const m of data.payments) await strapi.documents('api::payment-method.payment-method').create({ data: m });
  for (const pg of data.pages) await strapi.documents('api::page.page').create({ data: pg, status: 'published' });

  const logo = await upload(strapi, 'logo.png', 'Fragrance Vault');
  await strapi.documents('api::global.global').create({
    data: {
      siteName: 'Fragrance Vault', tagline: 'Perfumes kept under lock and key.', currency: 'LKR',
      footerText: 'Perfumes kept under lock and key. Secure insured shipping islandwide.', logo: logo ? logo.id : null,
      seo: { metaTitle: 'Fragrance Vault | Authentic perfumes in Sri Lanka', metaDescription: 'Authentic designer and Middle Eastern perfumes with secure insured shipping islandwide.' },
    },
  });
  const pick = (s) => bySlug[s] && bySlug[s].documentId;
  await strapi.documents('api::homepage.homepage').create({
    data: {
      heroEyebrow: 'The vault is open', heroTitle: 'Every great scent deserves a', heroHighlight: 'vault.',
      heroText: 'Scroll to travel through the seals. One perfume is waiting at the end of the tunnel.',
      chapterEyebrow: 'Seal by seal', chapterTitle: 'Top. Heart. Base.', chapterText: 'Every ring you pass is one layer of a perfume, turning like the dial of a safe.',
      boxesEyebrow: 'Deposit boxes', boxesTitle: 'Inside the vault', comboEyebrow: 'The combination', comboTitle: 'Three turns open every perfume',
      steps: [
        { label: 'Top notes', body: 'The first spark. Bright, light and gone within minutes.' },
        { label: 'Heart notes', body: 'The character of the perfume, turning like the wheel of a vault.' },
        { label: 'Base notes', body: 'What stays on your skin for hours. The part people remember.' },
      ],
      ctaTitle: 'Your signature is waiting behind the door', ctaText: 'Browse the full collection and open the box that feels like you.', ctaLabel: 'Open the collection',
      marqueeWords: 'Rasasi, Lattafa, Rayhaan, French Avenue, Armaf, Afnan, Mancera, Khadlaj',
      featuredProduct: pick('rasasi-hawas-ice-freeze'),
      featuredProducts: ['rasasi-hawas-ice-freeze', 'rasasi-hawas-fire', 'rasasi-hawas-malibu-eau-de-perfum', 'rasasi-hawas-for-her-edp'].map(pick).filter(Boolean),
    },
  });
  strapi.log.info(`Seeded ${data.products.length} products.`);
}

function slugify(s) {
  return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
