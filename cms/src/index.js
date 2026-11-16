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
    await adminListViews(strapi);
    if (process.env.SEED_ON_EMPTY !== 'false') await seed(strapi);
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
