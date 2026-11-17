'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Product } from '@/lib/strapi';
import { money } from '@/lib/format';
import { useCart } from './cart';
import ProductStage from './ProductStage';

const TINTS = ['#FFC46B', '#8FE0C0', '#8FD0F0'];

export default function BuyBox({ p }: { p: Product }) {
  const { add } = useCart();
  const [variant, setVariant] = useState<number>(p.variants.length ? 0 : -1);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState(0);
  const [added, setAdded] = useState(false);
  const notes = [['Top', p.topNotes], ['Heart', p.heartNotes], ['Base', p.baseNotes]].filter(([, v]) => v) as [string, string][];

  const v = variant >= 0 ? p.variants[variant] : null;
  const regular = v ? v.price : p.price;
  const sale = v ? (v.salePrice !== null && v.salePrice < v.price ? v.salePrice : null) : p.salePrice;
  const now = sale ?? regular;
  const left = v && v.stock !== null ? v.stock : p.stock;
  const inStock = v && v.stock !== null ? v.stock > 0 : p.inStock;
  const max = left === null ? 99 : Math.max(1, Math.min(99, left));

  const addToCart = () => {
    add({ id: p.id, slug: p.slug, name: p.name, variant: v ? v.label : null, price: now, image: p.image?.url || null }, qty);
    setAdded(true);
    window.dispatchEvent(new Event('fv:added'));
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <>
      <ProductStage images={p.images} name={p.name} accent={p.accent} noteTint={notes.length ? TINTS[note] : null} />
      <div className="info">
        <div className="info-head">
          <span className="eyebrow">{[p.brand?.name, ...p.categories.map((c) => c.name).filter((n) => n !== p.brand?.name)].filter(Boolean).slice(0, 3).join(' · ')}</span>
          <h1>{p.name}</h1>
          {p.shortDescription ? <p className="lead">{p.shortDescription}</p> : null}
        </div>

        <div className="pdp-price">
          <b>{money(now)}</b>
          {sale !== null ? <s>{money(regular)}</s> : null}
          <span className="hint">{[p.concentration, p.size].filter(Boolean).join(' · ')}</span>
        </div>

        {p.variants.length ? (
          <div className="group">
            <span className="label">Size</span>
            <div className="pills" role="radiogroup" aria-label="Size">
              {p.variants.map((x, i) => (
                <button key={x.label} type="button" role="radio" aria-checked={i === variant} className={`chip ${i === variant ? 'on' : ''}`} onClick={() => setVariant(i)}>{x.label}</button>
              ))}
            </div>
          </div>
        ) : null}

        {notes.length ? (
          <div className="group">
            <span className="label">The combination</span>
            <div className="notes" style={{ gridTemplateColumns: `repeat(${notes.length}, minmax(0, 1fr))` }}>
              {notes.map(([k], i) => (
                <button key={k} type="button" className={i === note ? 'on' : ''} aria-pressed={i === note} onClick={() => setNote(i)}><span>{k}</span></button>
              ))}
            </div>
            <p className="notice" aria-live="polite">{notes[note][0]} notes: {notes[note][1]}</p>
          </div>
        ) : null}

        {inStock ? (
          <div className="buy">
            <div className="qty" role="group" aria-label="Quantity">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <span aria-live="polite">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Increase quantity">+</button>
            </div>
            <button type="button" className="btn btn-gold" onClick={addToCart}>{added ? 'Locked in your vault' : 'Add to vault'}</button>
          </div>
        ) : (
          <p className="notice">This perfume is sold out right now. Message us and we will tell you when it is back.</p>
        )}
        {added ? <p className="hint" aria-live="polite">Added. <Link href="/cart">View your bag</Link> or <Link href="/checkout">check out</Link>.</p> : null}
        {left !== null && left > 0 && left <= 3 ? <p className="hint">Only {left} left in the vault.</p> : null}
      </div>
    </>
  );
}
