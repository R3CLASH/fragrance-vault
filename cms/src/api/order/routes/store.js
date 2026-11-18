'use strict';
// Public store endpoints. Orders are never exposed through the generic REST API.
// Each one is rate-limited per visitor (see src/middlewares/store-limit.js).
const limit = (scope, max, windowSec) => ({ middlewares: [{ name: 'global::store-limit', config: { scope, max, windowSec } }] });

module.exports = {
  routes: [
    // the cart and checkout re-price the bag as it changes, so this one is generous
    { method: 'POST', path: '/checkout/quote', handler: 'order.quote', config: { auth: false, ...limit('quote', 120, 600) } },
    { method: 'POST', path: '/checkout', handler: 'order.checkout', config: { auth: false, ...limit('checkout', 10, 600) } },
    { method: 'POST', path: '/orders/lookup', handler: 'order.lookup', config: { auth: false, ...limit('lookup', 30, 600) } },
    // PayHere's own servers call this; every call must carry a valid signature
    { method: 'POST', path: '/payments/payhere/notify', handler: 'order.payhereNotify', config: { auth: false, ...limit('payhere', 120, 600) } },
  ],
};
