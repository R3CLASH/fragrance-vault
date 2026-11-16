'use strict';
// Public store endpoints. Orders are never exposed through the generic REST API.
module.exports = {
  routes: [
    { method: 'POST', path: '/checkout/quote', handler: 'order.quote', config: { auth: false } },
    { method: 'POST', path: '/checkout', handler: 'order.checkout', config: { auth: false } },
    { method: 'POST', path: '/orders/lookup', handler: 'order.lookup', config: { auth: false } },
    { method: 'POST', path: '/payments/payhere/notify', handler: 'order.payhereNotify', config: { auth: false } },
  ],
};
