import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import BuyBox from '@/components/BuyBox';
import ProductCard from '@/components/ProductCard';
import { Drawers } from '@/components/Motion';
import { getPaymentMethods, getProduct, getProducts } from '@/lib/strapi';
import { SITE_URL } from '@/lib/format';

export const revalidate = 30;
type P = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return { title: 'Not found' };
  const description = p.metaDescription || p.shortDescription || undefined;
  return {
    title: p.metaTitle?.replace(/ \| Fragrance Vault$/, '') || p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description, images: p.image ? [{ url: p.image.url }] : undefined, type: 'website' },
  };
}

export default async function ProductPage({ params }: { params: P }) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const pool = p.brand ? await getProducts({ brand: p.brand.slug, limit: 8 }) : await getProducts({ limit: 8 });
  const related = pool.filter((x) => x.id !== p.id).slice(0, 3);
  // payment offers (e.g. bank transfer 10% off) are shown under the price
  const bank = (await getPaymentMethods()).find((m) => m.type === 'bank_transfer' && m.feePercent < 0);
  const offer = bank ? { name: bank.name, percent: -bank.feePercent } : null;
  const html = p.description && p.description !== p.shortDescription ? await marked.parse(p.description) : null;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku || undefined,
    brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
    description: p.shortDescription || undefined, image: p.images.map((i) => `${SITE_URL}${i.url}`),
    offers: { '@type': 'Offer', priceCurrency: 'LKR', price: p.current, availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: `${SITE_URL}/product/${p.slug}` },
  };

  return (
    <div className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span aria-hidden="true">/</span>
          <Link href="/shop">The Vault</Link><span aria-hidden="true">/</span>
          {p.brand ? <><Link href={`/shop?brand=${p.brand.slug}`}>{p.brand.name}</Link><span aria-hidden="true">/</span></> : null}
          <span style={{ color: 'var(--ink)' }}>{p.name}</span>
        </nav>
        <div className="pdp"><BuyBox p={p} offer={offer} /></div>
        <div className="acc" style={{ maxWidth: 760, marginBottom: 80 }}>
          {html ? <details open><summary>About this scent</summary><div className="prose" dangerouslySetInnerHTML={{ __html: html }} /></details> : null}
          <details open={!html}><summary>Delivery</summary><div className="prose"><p>Secure insured shipping islandwide. You will get an email at every step, with a link to follow your order.</p></div></details>
          <details><summary>Authenticity</summary><div className="prose"><p>Every bottle in the vault is an authentic product.</p></div></details>
        </div>
      </div>
      {related.length ? (
        <section className="related">
          <div className="wrap section">
            <div className="sec-head"><h2>Next to it in the vault</h2><Link className="more" href={p.brand ? `/shop?brand=${p.brand.slug}` : '/shop'}>View all boxes</Link></div>
            <Drawers>{related.map((r, i) => <div key={r.id}><div><ProductCard p={r} i={i} /></div></div>)}</Drawers>
          </div>
        </section>
      ) : null}
    </div>
  );
}
