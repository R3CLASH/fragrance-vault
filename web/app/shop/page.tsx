import type { Metadata } from 'next';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ShopWheel from '@/components/ShopWheel';
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
const SORTS = [['', 'Newest'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['name', 'Name']];

export default async function Shop({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [products, categories, brands] = await Promise.all([
    getProducts({ category: sp.category, brand: sp.brand, gender: sp.gender, q: sp.q, sort: sp.sort }),
    getCategories(),
    getBrands(),
  ]);
  const link = (patch: Record<string, string | undefined>) => {
    const next = { ...sp, ...patch };
    const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    return `/shop${qs ? `?${qs}` : ''}`;
  };
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

      <div className="filters">
        <div className="wrap">
          <div className="filter-row" role="group" aria-label="Range">
            <span>Range</span>
            <Link className={`chip ${!sp.category ? 'on' : ''}`} href={link({ category: undefined })}>All</Link>
            {categories.map((c) => <Link key={c.slug} className={`chip ${sp.category === c.slug ? 'on' : ''}`} href={link({ category: c.slug })}>{c.name}</Link>)}
          </div>
          <div className="filter-row" role="group" aria-label="House">
            <span>House</span>
            <Link className={`chip ${!sp.brand ? 'on' : ''}`} href={link({ brand: undefined })}>All</Link>
            {brands.map((b) => <Link key={b.slug} className={`chip ${sp.brand === b.slug ? 'on' : ''}`} href={link({ brand: b.slug })}>{b.name}</Link>)}
          </div>
          <div className="filter-row">
            <form className="search" action="/shop" role="search">
              {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
              {sp.brand ? <input type="hidden" name="brand" value={sp.brand} /> : null}
              <label className="sr" htmlFor="q">Search perfumes</label>
              <input id="q" name="q" type="search" placeholder="Search the vault" defaultValue={sp.q || ''} />
              <button className="btn" type="submit" style={{ minHeight: 46, padding: '0 18px' }}>Search</button>
            </form>
            <form className="sort" action="/shop">
              {Object.entries(sp).filter(([k, v]) => k !== 'sort' && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v as string} />)}
              <label htmlFor="sort" className="label">Sort</label>
              <select id="sort" name="sort" defaultValue={sp.sort || ''}>
                {SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <button className="btn" type="submit" style={{ minHeight: 46, padding: '0 16px' }}>Apply</button>
            </form>
            <span style={{ fontSize: 14, color: 'var(--mute)' }}>{products.length} {products.length === 1 ? 'box' : 'boxes'}</span>
          </div>
        </div>
      </div>

      <div className="wrap section" style={{ paddingTop: 48 }}>
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
