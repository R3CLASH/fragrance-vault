/** @type {import('next').NextConfig} */
const STRAPI = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  // Strapi uploads are served from this site's own origin (/media/...).
  // Same-origin images keep the canvas "particle bottle" effect working and avoid CORS setup.
  async rewrites() {
    return [{ source: '/media/:path*', destination: `${STRAPI}/uploads/:path*` }];
  },
};

export default nextConfig;
