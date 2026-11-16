'use strict';
const { factories } = require('@strapi/strapi');
const store = require('../../../utils/store');

function fail(ctx, e, strapi) {
  if (e instanceof store.StoreError) {
    ctx.status = e.status;
    ctx.body = { error: { message: e.message, details: e.details || null } };
    return;
  }
  strapi.log.error(e);
  ctx.status = 500;
  ctx.body = { error: { message: 'Something went wrong. Please try again.' } };
}

module.exports = factories.createCoreController('api::order.order', ({ strapi }) => ({
  async quote(ctx) {
    try { ctx.body = await store.quote(strapi, ctx.request.body || {}); } catch (e) { fail(ctx, e, strapi); }
  },

  async checkout(ctx) {
    try {
      const { order, payment } = await store.placeOrder(strapi, ctx.request.body || {}, { ip: ctx.request.ip });
      ctx.status = 201;
      ctx.body = { orderNumber: order.orderNumber, token: order.accessToken, status: order.orderStatus, total: Number(order.total), payment };
    } catch (e) { fail(ctx, e, strapi); }
  },

  async lookup(ctx) {
    try {
      const { orderNumber, token, email } = ctx.request.body || {};
      if (!orderNumber || (!token && !email)) throw new store.StoreError('Enter your order number and email address.');
      const o = await store.findOrder(strapi, token ? { orderNumber, token: String(token) } : { orderNumber, email: String(email) });
      if (!o) throw new store.StoreError('We could not find an order with those details.', 404);
      const out = store.publicOrder(o);
      if (token && o.orderStatus === 'pending_payment' && o.paymentMethodType === 'payhere') {
        const pm = await strapi.documents('api::payment-method.payment-method').findMany({ filters: { type: 'payhere', enabled: true }, limit: 1 });
        if (pm[0]) out.payment = await store.paymentStep(strapi, o, pm[0].documentId);
      } else if (token && ['bank_transfer', 'koko', 'payzy', 'manual'].includes(o.paymentMethodType) && o.paymentStatus !== 'paid') {
        const pm = await strapi.documents('api::payment-method.payment-method').findMany({ filters: { type: o.paymentMethodType }, limit: 1 });
        if (pm[0]) out.payment = { type: pm[0].type, name: pm[0].name, instructions: pm[0].instructions || null };
      }
      ctx.body = out;
    } catch (e) { fail(ctx, e, strapi); }
  },

  async payhereNotify(ctx) {
    try { ctx.body = await store.payhereNotify(strapi, ctx.request.body || {}); } catch (e) { fail(ctx, e, strapi); }
  },
}));
