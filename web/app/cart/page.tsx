'use client';

import Link from 'next/link';
import { useCart, useQuote } from '@/components/cart';
import { money } from '@/lib/format';

export default function CartPage() {
  const { items, ready, setQty, remove } = useCart();
  const { quote, error, problem, live } = useQuote();

  if (!ready) return <div className="page"><div className="wrap"><p className="lead">Opening your vault…</p></div></div>;

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head"><span className="eyebrow">Your vault</span><h1>Your bag</h1></div>
        {!items.length ? (
          <div className="empty"><p>Your bag is empty.</p><Link className="btn btn-gold" href="/shop">Open the collection</Link></div>
        ) : (
          <div className="split">
            <div className="main">
              <div className="panel" style={{ gap: 0 }}>
                {items.map((i) => {
                  const l = live(i);
                  const price = l ? l.unitPrice : i.price;
                  return (
                    <div className="line" key={i.key}>
                      <div className="line-img">{i.image ? <img src={i.image} alt="" /> : null}</div>
                      <div className="line-info">
                        <Link href={`/product/${i.slug}`}>{i.name}</Link>
                        <small>{i.variant ? `${i.variant} · ` : ''}{money(price)} each</small>
                        {problem(i) ? <small style={{ color: '#ffb4a8' }}>{problem(i)}</small> : null}
                      </div>
                      <div className="line-end">
                        <span className="price">{money(price * i.qty)}</span>
                        <div className="qty sm" role="group" aria-label={`Quantity of ${i.name}`}>
                          <button type="button" onClick={() => setQty(i.key, i.qty - 1)} aria-label="Decrease">−</button>
                          <span>{i.qty}</span>
                          <button type="button" onClick={() => setQty(i.key, i.qty + 1)} aria-label="Increase">+</button>
                        </div>
                        <button type="button" className="link-btn" onClick={() => remove(i.key)}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link href="/shop" className="more" style={{ alignSelf: 'flex-start' }}>Keep browsing</Link>
            </div>
            <aside className="side">
              <div className="panel">
                <h2>Summary</h2>
                {error ? <p className="notice error">{error}</p> : null}
                <div className="totals">
                  <div><span>Subtotal</span><span>{quote ? money(quote.subtotal) : '…'}</span></div>
                  <div><span>Delivery</span><span>Calculated at checkout</span></div>
                  <div className="grand"><span>Estimated total</span><b>{quote ? money(quote.subtotal) : '…'}</b></div>
                </div>
                {quote?.problems.length ? <p className="notice error">Please fix the items marked above before checking out.</p> : null}
                <Link className={`btn btn-gold btn-block ${quote?.problems.length ? 'disabled' : ''}`} href="/checkout" aria-disabled={!!quote?.problems.length}>Check out</Link>
                <p className="hint">Bank transfer, card, Koko and Payzy available at checkout.</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
