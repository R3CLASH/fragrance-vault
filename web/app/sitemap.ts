import type { MetadataRoute } from 'next';
import { getPages, getProducts } from '@/lib/strapi';
import { SITE_URL } from '@/lib/format';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, pages] = await Promise.all([getProducts({ limit: 500 }), getPages()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: 'daily', priority: 0.9 },
    ...products.map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...pages.map((p) => ({ url: `${SITE_URL}/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.4 })),
  ];
}
