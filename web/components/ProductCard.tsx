'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { Product } from '@/lib/strapi';
import { money, GENDERS } from '@/lib/format';
import { useCart } from './cart';

export function Price({ p }: { p: Product }) {
  return p.onSale ? (
    <span className="price"><s>{money(p.price)}</s>{money(p.current)}</span>
  ) : (
    <span className="price">{money(p.current)}</span>
  );
}

const Plus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

/** A safe-deposit box: numbered plate, spotlit bottle on a plinth, and a lock-in button. */
export default function ProductCard({ p, i = 0 }: { p: Product; i?: number }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const href = `/product/${p.slug}`;
  const pick = p.variants.length > 1; // several sizes: choose one on the product page
  const box = p.sku || `No. ${String(i + 1).padStart(3, '0')}`;
  const sub = [p.concentration, p.size].filter(Boolean).join(' · ') || 'Eau de Parfum';

  const addToCart = () => {
    const v = p.variants[0] || null;
    const price = v ? (v.salePrice !== null && v.salePrice < v.price ? v.salePrice : v.price) : p.current;
    add({ id: p.id, slug: p.slug, name: p.name, variant: v ? v.label : null, price, image: p.image?.url || null }, 1);
    window.dispatchEvent(new Event('fv:added'));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // pointer tilt: one transform on the card, written straight to the element
  const tilt = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`); el.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
  };
  const reset = () => { const el = ref.current; if (el) { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); } };

  return (
    <article ref={ref} className={`card${p.inStock ? '' : ' is-out'}`} onPointerMove={tilt} onPointerLeave={reset}>
      <div className="card-plate">
        <span>{p.brand?.name || 'The Vault'}</span>
        <i aria-hidden="true" />
        <span>{p.gender ? GENDERS[p.gender] : box}</span>
      </div>

      <div className="card-stage">
        {p.onSale ? <span className="badge">Sale</span> : !p.inStock ? <span className="badge out">Sold out</span> : null}
        <span className="card-box" aria-hidden="true">{box}</span>
        <div className="card-img">
          {p.image ? (
            <img src={p.image.url} alt={p.image.alt || p.name} loading="lazy" decoding="async" width={p.image.width} height={p.image.height} />
          ) : (
            <span className="ph" aria-hidden="true"><b>{(p.brand?.name || p.name).charAt(0)}</b></span>
          )}
        </div>
      </div>

      <div className="card-info">
        <Link className="card-name" href={href}>{p.name}</Link>
        <span className="card-sub">{sub}</span>
      </div>

      <div className="card-foot">
        <Price p={p} />
        {!p.inStock ? (
          <Link className="card-add ghost" href={href}>Details</Link>
        ) : pick ? (
          <Link className="card-add" href={href}>Choose size</Link>
        ) : (
          <button type="button" className={`card-add${added ? ' done' : ''}`} onClick={addToCart} aria-label={added ? `${p.name} added to your vault` : `Add ${p.name} to your vault`}>
            {added ? <><Check /><span>Added</span></> : <><Plus /><span>Add</span></>}
          </button>
        )}
      </div>
    </article>
  );
}
