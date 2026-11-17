// Small data layer between the storefront and the Strapi CMS.
// Every function returns safe fallbacks, so pages still render if the CMS is briefly unreachable.

// At runtime prefer the CMS's private address (no public egress, faster); builds can't reach it, so they use STRAPI_URL.
export const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const TOKEN = process.env.STRAPI_API_TOKEN || '';

export type Media = { url: string; alt: string; width?: number; height?: number };

export type Variant = { label: string; price: number; salePrice: number | null; stock: number | null; sku: string | null };

export type Product = {
  id: string; // Strapi documentId
  slug: string;
  name: string;
  sku: string | null;
  price: number;
  salePrice: number | null;
  current: number; // the price a customer pays right now
  onSale: boolean;
  images: Media[];
  image: Media | null;
  brand: { name: string; slug: string } | null;
  categories: { name: string; slug: string }[];
  gender: 'for-him' | 'for-her' | 'unisex' | null;
  size: string | null;
  concentration: string | null;
  shortDescription: string | null;
  description: string | null;
  topNotes: string | null;
  heartNotes: string | null;
  baseNotes: string | null;
  accent: string | null;
  featured: boolean;
  inStock: boolean;
  stock: number | null;
  variants: Variant[];
  metaTitle: string | null;
  metaDescription: string | null;
};

export type PaymentMethod = { id: string; name: string; type: string; description: string | null; feePercent: number; feeFixed: number };
export type ShippingMethod = { id: string; name: string; description: string | null; rate: number; freeOver: number | null; estimatedDays: string | null };

export type Global = {
  siteName: string; tagline: string; announcement: string | null; footerText: string;
  contactEmail: string | null; contactPhone: string | null; whatsapp: string | null;
  instagram: string | null; facebook: string | null; tiktok: string | null; logo: Media | null;
};

export type Home = {
  heroEyebrow: string; heroTitle: string; heroHighlight: string; heroText: string;
  chapterEyebrow: string; chapterTitle: string; chapterText: string;
  boxesEyebrow: string; boxesTitle: string;
  comboEyebrow: string; comboTitle: string; steps: { label: string; body: string }[];
  ctaTitle: string; ctaText: string; ctaLabel: string;
  featuredProduct: Product | null; featuredProducts: Product[]; marqueeWords: string | null;
};

type FetchOpts = { revalidate?: number; method?: string; body?: unknown };

export async function strapi<T = any>(path: string, opts: FetchOpts = {}): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(`${STRAPI_URL}/api${path}`, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      ...(opts.method && opts.method !== 'GET' ? { cache: 'no-store' as const } : { next: { revalidate: opts.revalidate ?? 30 } }),
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

export function mediaUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/uploads/') ? `/media/${url.slice('/uploads/'.length)}` : url;
}

function toMedia(m: any, fallbackAlt: string): Media | null {
  const url = mediaUrl(m?.url);
  return url ? { url, alt: m.alternativeText || fallbackAlt, width: m.width, height: m.height } : null;
}

export function toProduct(p: any): Product {
  const images = (Array.isArray(p.images) ? p.images : []).map((m: any) => toMedia(m, p.name)).filter(Boolean) as Media[];
  const price = num(p.price);
  const sale = numOrNull(p.salePrice);
  const onSale = sale !== null && sale > 0 && sale < price;
  const stock = p.manageStock ? num(p.stock) : null;
  return {
    id: p.documentId,
    slug: p.slug,
    name: p.name,
    sku: p.sku || null,
    price,
    salePrice: onSale ? sale : null,
    current: onSale ? (sale as number) : price,
    onSale,
    images,
    image: images[0] || null,
    brand: p.brand ? { name: p.brand.name, slug: p.brand.slug } : null,
    categories: (p.categories || []).map((c: any) => ({ name: c.name, slug: c.slug })),
    gender: p.gender || null,
    size: p.size || null,
    concentration: p.concentration || null,
    shortDescription: p.shortDescription || null,
    description: p.description || null,
    topNotes: p.topNotes || null,
    heartNotes: p.heartNotes || null,
    baseNotes: p.baseNotes || null,
    accent: p.accent || null,
    featured: !!p.featured,
    inStock: p.manageStock ? num(p.stock) > 0 : p.inStock !== false,
    stock,
    variants: (p.variants || []).map((v: any) => ({
      label: v.label, price: num(v.price), salePrice: numOrNull(v.salePrice), stock: numOrNull(v.stock), sku: v.sku || null,
    })),
    metaTitle: p.seo?.metaTitle || null,
    metaDescription: p.seo?.metaDescription || null,
  };
}

const PRODUCT_POPULATE = 'populate[images]=true&populate[brand]=true&populate[categories]=true&populate[variants]=true&populate[seo]=true';

export type ProductQuery = { category?: string; brand?: string; gender?: string; q?: string; sort?: string; featured?: boolean; limit?: number };

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const qs: string[] = [PRODUCT_POPULATE, `pagination[pageSize]=${query.limit || 100}`];
  if (query.category) qs.push(`filters[categories][slug][$eq]=${encodeURIComponent(query.category)}`);
  if (query.brand) qs.push(`filters[brand][slug][$eq]=${encodeURIComponent(query.brand)}`);
  if (query.gender) qs.push(`filters[gender][$eq]=${encodeURIComponent(query.gender)}`);
  if (query.featured) qs.push('filters[featured][$eq]=true');
  // Search: every word must appear somewhere (name, house, range, SKU, concentration or notes),
  // so "rasasi fire" finds "Rasasi Hawas Fire" and "vanilla" finds perfumes with vanilla notes.
  const words = (query.q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const SEARCH_FIELDS = ['name', 'sku', 'brand][name', 'categories][name', 'concentration', 'topNotes', 'heartNotes', 'baseNotes'];
  words.forEach((w, i) => SEARCH_FIELDS.forEach((f, j) => qs.push(`filters[$and][${i}][$or][${j}][${f}][$containsi]=${encodeURIComponent(w)}`)));
  const sort: Record<string, string> = { 'price-asc': 'price:asc', 'price-desc': 'price:desc', name: 'name:asc', newest: 'createdAt:desc' };
  qs.push(`sort=${sort[query.sort || ''] || 'createdAt:desc'}`);
  const { data } = await strapi<any>(`/products?${qs.join('&')}`);
  return (data?.data || []).map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const { data } = await strapi<any>(`/products?filters[slug][$eq]=${encodeURIComponent(slug)}&${PRODUCT_POPULATE}`);
  const p = data?.data?.[0];
  return p ? toProduct(p) : null;
}

export async function getCategories(): Promise<{ name: string; slug: string }[]> {
  const { data } = await strapi<any>('/categories?sort=name:asc&pagination[pageSize]=100');
  return (data?.data || []).map((c: any) => ({ name: c.name, slug: c.slug }));
}

export async function getBrands(): Promise<{ name: string; slug: string }[]> {
  const { data } = await strapi<any>('/brands?sort=name:asc&pagination[pageSize]=100');
  return (data?.data || []).map((c: any) => ({ name: c.name, slug: c.slug }));
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await strapi<any>('/payment-methods?filters[enabled][$eq]=true&sort=sortOrder:asc', { revalidate: 10 });
  return (data?.data || []).map((m: any) => ({
    id: m.documentId, name: m.name, type: m.type, description: m.description || null, feePercent: num(m.feePercent), feeFixed: num(m.feeFixed),
  }));
}

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  const { data } = await strapi<any>('/shipping-methods?filters[enabled][$eq]=true&sort=sortOrder:asc', { revalidate: 10 });
  return (data?.data || []).map((m: any) => ({
    id: m.documentId, name: m.name, description: m.description || null, rate: num(m.rate), freeOver: numOrNull(m.freeOver), estimatedDays: m.estimatedDays || null,
  }));
}

export async function getGlobal(): Promise<Global> {
  const { data } = await strapi<any>('/global?populate=*');
  const g = data?.data || {};
  return {
    siteName: g.siteName || 'Fragrance Vault',
    tagline: g.tagline || 'Perfumes kept under lock and key.',
    announcement: g.announcement || null,
    footerText: g.footerText || 'Perfumes kept under lock and key. Secure insured shipping islandwide.',
    contactEmail: g.contactEmail || null, contactPhone: g.contactPhone || null, whatsapp: g.whatsapp || null,
    instagram: g.instagram || null, facebook: g.facebook || null, tiktok: g.tiktok || null,
    logo: toMedia(g.logo, g.siteName || 'Fragrance Vault'),
  };
}

export async function getHome(): Promise<Home> {
  const pop = 'populate[steps]=true&populate[featuredProduct][populate]=*&populate[featuredProducts][populate]=*';
  const { data } = await strapi<any>(`/homepage?${pop}`);
  const h = data?.data || {};
  const steps = (h.steps || []).map((s: any) => ({ label: s.label, body: s.body }));
  return {
    heroEyebrow: h.heroEyebrow || 'The vault is open',
    heroTitle: h.heroTitle || 'Every great scent deserves a',
    heroHighlight: h.heroHighlight || 'vault.',
    heroText: h.heroText || 'Scroll to travel through the seals. One perfume is waiting at the end of the tunnel.',
    chapterEyebrow: h.chapterEyebrow || 'Seal by seal',
    chapterTitle: h.chapterTitle || 'Top. Heart. Base.',
    chapterText: h.chapterText || 'Every ring you pass is one layer of a perfume, turning like the dial of a safe.',
    boxesEyebrow: h.boxesEyebrow || 'Deposit boxes',
    boxesTitle: h.boxesTitle || 'Inside the vault',
    comboEyebrow: h.comboEyebrow || 'The combination',
    comboTitle: h.comboTitle || 'Three turns open every perfume',
    steps: steps.length === 3 ? steps : [
      { label: 'Top notes', body: 'The first spark. Bright, light and gone within minutes.' },
      { label: 'Heart notes', body: 'The character of the perfume, turning like the wheel of a vault.' },
      { label: 'Base notes', body: 'What stays on your skin for hours. The part people remember.' },
    ],
    ctaTitle: h.ctaTitle || 'Your signature is waiting behind the door',
    ctaText: h.ctaText || 'Browse the full collection and open the box that feels like you.',
    ctaLabel: h.ctaLabel || 'Open the collection',
    featuredProduct: h.featuredProduct ? toProduct(h.featuredProduct) : null,
    featuredProducts: (h.featuredProducts || []).map(toProduct),
    marqueeWords: h.marqueeWords || null,
  };
}

export async function getPage(slug: string): Promise<{ title: string; content: string; metaTitle: string | null; metaDescription: string | null } | null> {
  const { data } = await strapi<any>(`/pages?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`);
  const p = data?.data?.[0];
  return p ? { title: p.title, content: p.content || '', metaTitle: p.seo?.metaTitle || null, metaDescription: p.seo?.metaDescription || null } : null;
}

export async function getPages(): Promise<{ title: string; slug: string }[]> {
  const { data } = await strapi<any>('/pages?fields[0]=title&fields[1]=slug&pagination[pageSize]=100');
  return (data?.data || []).map((p: any) => ({ title: p.title, slug: p.slug }));
}
