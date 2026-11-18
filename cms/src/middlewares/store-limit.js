'use strict';

/**
 * Per-visitor rate limit for the public shop endpoints (checkout, quote, order lookup).
 * Stops scripts from spamming fake orders or guessing order numbers, while staying far above
 * what a real shopper does. In-memory, so limits reset when the CMS restarts.
 *
 * Use on a route:  config: { middlewares: [{ name: 'global::store-limit', config: { max: 10, windowSec: 600 } }] }
 */
const buckets = new Map();
let lastSweep = 0;

// The real visitor IP. Railway's edge (or the storefront, over the private network) appends it as the
// LAST X-Forwarded-For entry; anything before that could have been typed by the client, so it is ignored.
function clientIp(ctx) {
  const xff = String(ctx.request.header['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || ctx.request.ip || 'unknown';
}

module.exports = (config = {}) => {
  const max = config.max || 30;
  const windowMs = (config.windowSec || 600) * 1000;
  const scope = config.scope || 'store';

  return async (ctx, next) => {
    const now = Date.now();
    if (now - lastSweep > 60000) {
      lastSweep = now;
      for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
    }
    const key = `${scope}:${clientIp(ctx)}`;
    let b = buckets.get(key);
    if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
    b.count += 1;
    if (b.count > max) {
      const wait = Math.ceil((b.reset - now) / 1000);
      ctx.set('Retry-After', String(wait));
      ctx.status = 429;
      ctx.body = { error: { message: `Too many attempts. Please wait ${wait > 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`} and try again.`, details: null } };
      return;
    }
    await next();
  };
};
