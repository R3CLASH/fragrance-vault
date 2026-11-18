'use strict';

/**
 * Stockroom companion plugin.
 * - Stores Expo push tokens for the Stockroom mobile app (per admin user).
 * - Watches your order content type and pushes "new / cancelled / completed" alerts.
 * Works with Strapi v4 and v5. No admin UI needed.
 */

const STORE_KEY = 'devices';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const bucketOf = (value) => {
  const v = String(value || '').toLowerCase();
  if (!v) return 'other';
  if (/refund/.test(v)) return 'refunded';
  if (/cancel|void|declin|fail|reject|abandon/.test(v)) return 'cancelled';
  if (/complet|deliver|fulfil|done|closed|finish/.test(v)) return 'completed';
  if (/process|paid|ship|dispatch|prepar|confirm|packed|in.?progress/.test(v)) return 'processing';
  if (/hold|wait/.test(v)) return 'on_hold';
  if (/pend|new|unpaid|created|placed|open/.test(v)) return 'pending';
  return 'other';
};

const pick = (attrs, patterns, types) => {
  const keys = Object.keys(attrs || {});
  for (const p of patterns) {
    const k = keys.find((key) => p.test(key) && (!types || types.includes(attrs[key].type)));
    if (k) return k;
  }
  return null;
};

function detectOrderModel(strapi, cfg) {
  const uid = cfg.orderUid || Object.keys(strapi.contentTypes).find((u) => u.startsWith('api::') && /(^|[.:])orders?$/.test(u.split('.').pop()) )
    || Object.keys(strapi.contentTypes).find((u) => u.startsWith('api::') && /order/i.test(u) && !/item|line/i.test(u));
  if (!uid || !strapi.contentTypes[uid]) return null;
  const attrs = strapi.contentTypes[uid].attributes;
  return {
    uid,
    statusField: cfg.statusField || pick(attrs, [/^order_?status$/i, /^status$/i, /status/i, /state/i], ['enumeration', 'string']),
    numberField: cfg.numberField || pick(attrs, [/^order_?number$/i, /^order_?no$/i, /^number$/i, /^reference$/i, /^code$/i, /number/i], ['string', 'uid', 'integer', 'biginteger']),
    totalField: cfg.totalField || pick(attrs, [/^grand_?total$/i, /^total$/i, /^total_?(price|amount)$/i, /^amount$/i, /total/i], ['decimal', 'float', 'integer', 'biginteger']),
    nameField: cfg.customerNameField || pick(attrs, [/^customer_?name$/i, /^full_?name$/i, /^billing_?name$/i, /^name$/i], ['string']),
  };
}

const store = (strapi) => strapi.store({ type: 'plugin', name: 'stockroom' });
const getDevices = async (strapi) => (await store(strapi).get({ key: STORE_KEY })) || [];
const setDevices = async (strapi, devices) => store(strapi).set({ key: STORE_KEY, value: devices });

async function sendPush(strapi, messages) {
  if (!messages.length) return;
  const invalid = new Set();
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => ({}));
      (json.data || []).forEach((ticket, idx) => {
        if (ticket.status === 'error' && ticket.details && ticket.details.error === 'DeviceNotRegistered') invalid.add(chunk[idx].to);
      });
    } catch (e) {
      strapi.log.warn(`[stockroom] push failed: ${e.message}`);
    }
  }
  if (invalid.size) {
    const devices = await getDevices(strapi);
    await setDevices(strapi, devices.filter((d) => !invalid.has(d.token)));
  }
}

function formatMoney(value, currency) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const s = n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return currency ? `${currency} ${s}` : s;
}

module.exports = {
  config: {
    default: {
      orderUid: null,          // e.g. 'api::order.order' (auto-detected when null)
      statusField: null,       // e.g. 'orderStatus'
      numberField: null,       // e.g. 'orderNumber'
      totalField: null,        // e.g. 'total'
      customerNameField: null, // e.g. 'customerName'
      currency: '',            // e.g. 'Rs.'
    },
    validator() {},
  },

  register() {},

  async bootstrap({ strapi }) {
    const cfg = strapi.config.get('plugin::stockroom') || strapi.config.get('plugin.stockroom') || {};
    const model = detectOrderModel(strapi, cfg);
    strapi.stockroomModel = model;
    if (!model) {
      strapi.log.warn('[stockroom] No order content type found. Set `orderUid` in config/plugins.');
      return;
    }
    strapi.log.info(`[stockroom] Watching ${model.uid} (status: ${model.statusField || 'n/a'})`);
    const recent = new Map();
    const seen = (key) => {
      const now = Date.now();
      for (const [k, t] of recent) if (now - t > 15000) recent.delete(k);
      if (recent.has(key)) return true;
      recent.set(key, now);
      return false;
    };

    const notify = async (event, entry) => {
      const devices = (await getDevices(strapi)).filter((d) => !d.events || d.events[event] !== false);
      if (!devices.length) return;
      const num = (model.numberField && entry[model.numberField]) || entry.documentId || entry.id;
      const total = model.totalField ? formatMoney(entry[model.totalField], cfg.currency) : '';
      const who = model.nameField ? entry[model.nameField] : '';
      const titles = { newOrder: '🛍️ New order', cancelled: 'Order cancelled', completed: '✅ Order completed' };
      const body = [`#${num}`, who, total].filter(Boolean).join(' · ');
      await sendPush(strapi, devices.map((d) => ({
        to: d.token, title: titles[event], body, sound: 'default', channelId: 'orders', priority: 'high',
        data: { type: 'order', event, uid: model.uid, documentId: entry.documentId || null, id: entry.id },
      })));
    };

    strapi.db.lifecycles.subscribe({
      models: [model.uid],
      async afterCreate(event) {
        const r = event.result || {};
        if (seen(`create:${r.documentId || r.id}`)) return;
        await notify('newOrder', r);
      },
      async beforeUpdate(event) {
        if (!model.statusField) return;
        try {
          const prev = await strapi.db.query(model.uid).findOne({ where: event.params.where, select: [model.statusField] });
          event.state.prevStatus = prev ? prev[model.statusField] : undefined;
        } catch (e) { /* ignore */ }
      },
      async afterUpdate(event) {
        if (!model.statusField) return;
        const r = event.result || {};
        const next = r[model.statusField];
        if (next === undefined || next === event.state.prevStatus) return;
        const b = bucketOf(next);
        const kind = b === 'cancelled' || b === 'refunded' ? 'cancelled' : b === 'completed' ? 'completed' : null;
        if (!kind || seen(`${kind}:${r.documentId || r.id}`)) return;
        await notify(kind, r);
      },
    });
  },

  routes: {
    admin: {
      type: 'admin',
      routes: [
        { method: 'GET', path: '/status', handler: 'devices.status', config: { policies: ['admin::isAuthenticatedAdmin'] } },
        { method: 'POST', path: '/devices', handler: 'devices.register', config: { policies: ['admin::isAuthenticatedAdmin'] } },
        { method: 'POST', path: '/devices/remove', handler: 'devices.unregister', config: { policies: ['admin::isAuthenticatedAdmin'] } },
        { method: 'POST', path: '/test', handler: 'devices.test', config: { policies: ['admin::isAuthenticatedAdmin'] } },
      ],
    },
  },

  controllers: {
    devices: ({ strapi }) => ({
      async status(ctx) {
        const devices = await getDevices(strapi);
        const m = strapi.stockroomModel;
        ctx.body = { data: { version: '1.0.0', orderModel: m, devices: devices.filter((d) => d.userId === ctx.state.user.id).length } };
      },
      async register(ctx) {
        const { token, platform, deviceName, events } = ctx.request.body || {};
        if (!token || typeof token !== 'string' || !/^Expo(nent)?PushToken\[/.test(token)) return ctx.badRequest('A valid Expo push token is required');
        const devices = (await getDevices(strapi)).filter((d) => d.token !== token);
        devices.push({ token, platform: platform || null, deviceName: deviceName || null, userId: ctx.state.user.id, events: events || { newOrder: true, cancelled: true, completed: true }, updatedAt: new Date().toISOString() });
        await setDevices(strapi, devices);
        ctx.body = { data: { ok: true } };
      },
      async unregister(ctx) {
        const { token } = ctx.request.body || {};
        const devices = await getDevices(strapi);
        await setDevices(strapi, devices.filter((d) => d.token !== token));
        ctx.body = { data: { ok: true } };
      },
      async test(ctx) {
        const { token } = ctx.request.body || {};
        const devices = (await getDevices(strapi)).filter((d) => d.userId === ctx.state.user.id && (!token || d.token === token));
        await sendPush(strapi, devices.map((d) => ({ to: d.token, title: 'Stockroom is connected', body: 'You will get order alerts on this device.', sound: 'default', channelId: 'orders' })));
        ctx.body = { data: { sent: devices.length } };
      },
    }),
  },
};
