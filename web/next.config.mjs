/** @type {import('next').NextConfig} */

// Everything the site loads comes from its own origin (fonts are self-hosted, CMS images go through /media).
// The only outside destination is the PayHere card page, which the checkout form posts to.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js inlines its page data; no outside scripts are allowed
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.payhere.lk https://sandbox.payhere.lk",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // keeps order links (which carry an access code) from leaking to other sites through the Referer header
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  // Strapi uploads are served from this site's own origin by app/media/[...path]/route.ts.
  async headers() {
    // dev mode needs eval for fast refresh, so the strict headers apply to production builds only
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      { source: '/:path*', headers: securityHeaders },
      // private, per-customer pages: never cache them in shared caches or show them in search results
      { source: '/(cart|checkout|order)/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/(cart|checkout)', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }, { key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
};

export default nextConfig;
