'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useCart, useQuote } from './cart';
import { money } from '@/lib/format';
import { lockScroll } from '@/lib/scroll';

/** The bag as a vault door: it swings in from the right edge, its bolts retract, and the deposit slips slide out. */
export default function CartDrawer() {
  const { items, count, ready, setQty, remove, drawer: open, setDrawer } = useCart();
  const { quote, error, problem, live } = useQuote(open);
  const path = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);

  useEffect(() => { setDrawer(false); }, [path, setDrawer]);
  useEffect(() => {
    lockScroll('bag', open);
    if (!open) { back.current?.focus?.({ preventScroll: true }); return; }
    back.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('.bag-close')?.focus({ preventScroll: true }), 60);
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
      if (e.key !== 'Tab' || !panel.current) return;
      // keep keyboard focus inside the open door
      const f = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    window.addEventListener('keydown', keys);
    return () => { clearTimeout(t); window.removeEventListener('keydown', keys); };
  }, [open, setDrawer]);

  const n = ready ? count : 0;
  const subtotal = quote ? quote.subtotal : items.reduce((s, i) => s + i.qty * i.price, 0);
  const blocked = !!quote?.problems.length;

  return (
    <div className={`bag${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="bag-shade" onClick={() => setDrawer(false)} />
      <div ref={panel} className="bag-door" role="dialog" aria-modal="true" aria-label="Your bag" {...(open ? {} : { inert: true })}>
        <div className="bag-bolts" aria-hidden="true"><i /><i /><i /></div>

        <header className="bag-head">
          <span className="bag-dial" aria-hidden="true" style={{ ['--a' as string]: `${n * 45}deg` }}><i /></span>
          <div>
            <span className="eyebrow">Your vault</span>
            <h2>The bag <small>{n}</small></h2>
          </div>
          <button type="button" className="bag-close" onClick={() => setDrawer(false)} aria-label="Close the bag">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {!n ? (
          <div className="bag-empty">
            <div className="bag-safe" aria-hidden="true"><i /><b /></div>
            <h3>The vault is empty</h3>
            <p>Every box is still locked. Open the collection and choose a bottle to keep.</p>
            <Link className="btn btn-gold" href="/shop" onClick={() => setDrawer(false)}>Open the collection</Link>
          </div>
        ) : (
          <>
            <ol className="bag-list" data-lenis-prevent>
              {items.map((i, k) => {
                const l = live(i), price = l ? l.unitPrice : i.price, bad = problem(i);
                return (
                  <li key={i.key} className="slip" style={{ ['--k' as string]: k }}>
                    <Link className="slip-img" href={`/product/${i.slug}`} tabIndex={-1} aria-hidden="true">{i.image ? <img src={i.image} alt="" /> : <span className="ph" />}</Link>
                    <div className="slip-info">
                      <Link href={`/product/${i.slug}`}>{i.name}</Link>
                      <small>{i.variant ? `${i.variant} · ` : ''}{money(price)}</small>
                      {bad ? <small className="slip-bad">{bad}</small> : null}
                      <div className="slip-row">
                        <div className="qty sm" role="group" aria-label={`Quantity of ${i.name}`}>
                          <button type="button" onClick={() => setQty(i.key, i.qty - 1)} aria-label="Decrease">−</button>
                          <span>{i.qty}</span>
                          <button type="button" onClick={() => setQty(i.key, i.qty + 1)} aria-label="Increase">+</button>
                        </div>
                        <b>{money(price * i.qty)}</b>
                      </div>
                    </div>
                    <button type="button" className="slip-x" onClick={() => remove(i.key)} aria-label={`Remove ${i.name}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </li>
                );
              })}
            </ol>

            <footer className="bag-foot">
              {error ? <p className="notice error">{error}</p> : null}
              {blocked ? <p className="notice error">Some items need attention before checkout.</p> : null}
              <div className="bag-total"><span>Subtotal</span><b>{money(subtotal)}</b></div>
              <p className="hint">Delivery and payment options at checkout.</p>
              <Link className={`btn btn-gold btn-block${blocked ? ' disabled' : ''}`} href="/checkout" aria-disabled={blocked} onClick={() => setDrawer(false)}>
                Unlock checkout
              </Link>
              <Link className="bag-more" href="/cart" onClick={() => setDrawer(false)}>View the full bag</Link>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
