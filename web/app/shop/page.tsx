import type { Metadata } from 'next';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ShopWheel from '@/components/ShopWheel';
import ShopFilters from '@/components/ShopFilters';
import { Drawers } from '@/components/Motion';
import { getBrands, getCategories, getProducts } from '@/lib/strapi';

export const revalidate = 30;

type SP = Promise<{ category?: string; brand?: string; gender?: string; q?: string; sort?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const title = sp.q ? `Search: ${sp.q}` : 'The Vault: all perfumes';
  return { title, description: 'Shop authentic designer and Middle Eastern perfumes in Sri Lanka with secure insured shipping islandwide.', alternates: { canonical: '/shop' } };
}

const TINTS: Record<string, string> = { 'for-him': '#8FD0F0', 'for-her': '#F08AC8', unisex: '#F6E27A' };

export default async function Shop({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [products, categories, brands] = await Promise.all([
    getProducts({ category: sp.category, brand: sp.brand, gender: sp.gender, q: sp.q, sort: sp.sort }),
    getCategories(),
    getBrands(),
  ]);
  const filtered = !!(sp.category || sp.brand || sp.gender || sp.q);
  const tint = TINTS[sp.gender || ''] || (sp.category === 'for-her' ? TINTS['for-her'] : sp.category === 'for-him' ? TINTS['for-him'] : '#FF9E3D');
  const heading = sp.brand ? brands.find((b) => b.slug === sp.brand)?.name : sp.category ? categories.find((c) => c.slug === sp.category)?.name : null;

  return (
    <div className="page">
      <div className="wrap shop-head">
        <div>
          <div className="eyebrow">{heading || 'The collection'}</div>
          <h1>Choose your <span className="gold-text">deposit box</span></h1>
          <p className="lead">Authentic perfumes, one bottle per box. Choose a range or a house and watch the vault wheel reshape itself into a bottle.</p>
        </div>
        <div className="shop-canvas"><ShopWheel filtered={filtered} tint={tint} /></div>
      </div>

      <ShopFilters sp={sp} categories={categories} brands={brands} count={products.length} />

      <div className="wrap section" style={{ paddingTop: 40 }}>
        {products.length ? (
          <Drawers>
            {products.map((p, i) => <div key={p.id}><div><ProductCard p={p} i={i} /></div></div>)}
          </Drawers>
        ) : (
          <div className="empty"><p>No perfumes match that search.</p><Link className="btn" href="/shop">See every box</Link></div>
        )}
      </div>
    </div>
  );
}
