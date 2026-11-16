/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  // Strapi uploads are served from this site's own origin by app/media/[...path]/route.ts.
};

export default nextConfig;
