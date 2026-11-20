'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '@/components/cart';
import { money } from '@/lib/format';
import { post, type Quote } from '@/lib/store-client';
import { scrollToY } from '@/lib/scroll';

type Addr = { firstName: string; lastName: string; address1: string; address2: string; city: string; district: string; postcode: string; phone: string };
const EMPTY: Addr = { firstName: '', lastName: '', address1: '', address2: '', city: '', district: '', postcode: '', phone: '' };
const DISTRICTS = ['Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee', 'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Moneragala', 'Ratnapura', 'Kegalle'];

type Placed = { orderNumber: string; token: string; payment: { type: string; redirect?: { url: string; fields: Record<string, string> } | null } };

export default function Checkout() {
  const router = useRouter();
  const { items, ready, clear } = useCart();
  const [email, setEmail] = useState('');
  const [bill, setBill] = useState<Addr>(EMPTY);
  const [diff, setDiff] = useState(false);
  const [ship, setShip] = useState<Addr>(EMPTY);
  const [note, setNote] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payhere, setPayhere] = useState<Placed['payment']['redirect'] | null>(null);
  const payForm = useRef<HTMLFormElement>(null);
  // Saving the customer's details on this device is opt-in (personal data); it stays ticked for people who chose it before.
  const [remember, setRemember] = useState(false);
  // Secret test link for the Koko gateway while it runs on Koko's QA keys: /checkout?kokotest=CODE
  const [testCode, setTestCode] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('kokotest');
      if (fromUrl) sessionStorage.setItem('fv-kokotest', fromUrl.slice(0, 80));
      setTestCode(sessionStorage.getItem('fv-kokotest') || undefined);
    } catch { /* ignore */ }
  }, []);

  const cart = useMemo(() => items.map((i) => ({ id: i.id, variant: i.variant, quantity: i.qty })), [items]);

  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem('fv-checkout') || 'null'); if (saved) { setEmail(saved.email || ''); setBill({ ...EMPTY, ...saved.bill }); setRemember(true); } } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!ready || !cart.length) return;
    const t = setTimeout(async () => {
      const r = await post<Quote>('/api/quote', { items: cart, couponCode: coupon || undefined, shippingMethodId: shippingId, paymentMethodId: paymentId, email: email || undefined });
      if (r.data) { setQuote(r.data); if (!shippingId) setShippingId(r.data.shippingMethodId); if (!paymentId) setPaymentId(r.data.paymentMethodId); }
      else setError(r.error);
    }, 250);
    return () => clearTimeout(t);
  }, [cart, coupon, shippingId, paymentId, ready, email]);
  useEffect(() => { if (payhere && payForm.current) payForm.current.submit(); }, [payhere]);

  if (!ready) return <div className="page"><div className="wrap"><p className="lead">Opening your vault…</p></div></div>;
  if (!items.length && !busy && !payhere) return (
    <div className="page"><div className="wrap empty"><h1 style={{ fontSize: 40 }}>Your bag is empty</h1><Link className="btn btn-gold" href="/shop">Open the collection</Link></div></div>
  );

  const field = (a: Addr, set: (x: Addr) => void, k: keyof Addr, label: string, opts: { required?: boolean; full?: boolean; type?: string; auto?: string } = {}) => (
    <label className={opts.full ? 'full' : ''}>
      {label}{opts.required ? ' *' : ''}
      <input className="field" type={opts.type || 'text'} required={opts.required} autoComplete={opts.auto} value={a[k]} onChange={(e) => set({ ...a, [k]: e.target.value })} />
    </label>
  );
  const addressFields = (a: Addr, set: (x: Addr) => void, prefix: string) => (
    <div className="form-grid">
      {field(a, set, 'firstName', 'First name', { required: true, auto: `${prefix} given-name` })}
      {field(a, set, 'lastName', 'Last name', { auto: `${prefix} family-name` })}
      {field(a, set, 'address1', 'Street address', { required: true, full: true, auto: `${prefix} address-line1` })}
      {field(a, set, 'address2', 'Apartment, floor (optional)', { full: true, auto: `${prefix} address-line2` })}
      {field(a, set, 'city', 'Town / city', { required: true, auto: `${prefix} address-level2` })}
      <label>District
        <select className="field" value={a.district} onChange={(e) => set({ ...a, district: e.target.value })}>
          <option value="">Choose…</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      {field(a, set, 'postcode', 'Postcode (optional)', { auto: `${prefix} postal-code` })}
      {field(a, set, 'phone', 'Phone', { required: true, type: 'tel', auto: `${prefix} tel` })}
    </div>
  );

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { if (remember) localStorage.setItem('fv-checkout', JSON.stringify({ email, bill })); else localStorage.removeItem('fv-checkout'); } catch { /* ignore */ }
    const r = await post<Placed>('/api/checkout', {
      items: cart, email, billing: bill, shipToDifferentAddress: diff, shipping: diff ? ship : undefined, note,
      couponCode: coupon && quote?.coupon?.valid ? coupon : undefined, shippingMethodId: shippingId, paymentMethodId: paymentId, testCode,
    });
    if (!r.ok || !r.data) { setError(r.error); setBusy(false); scrollToY(0); return; }
    clear();
    if (r.data.payment.redirect) { setPayhere(r.data.payment.redirect); return; }
    router.push(`/order/${r.data.orderNumber}?token=${r.data.token}`);
  };

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head"><span className="eyebrow">Secure checkout</span><h1>Seal the vault</h1></div>
        {error ? <p className="notice error" role="alert" style={{ marginBottom: 24 }}>{error}</p> : null}
        <form className="split" onSubmit={place}>
          <div className="main">
            <section className="panel">
              <h2>Contact</h2>
              <div className="form-grid">
                <label className="full">Email *<input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              </div>
            </section>
            <section className="panel">
              <h2>Delivery details</h2>
              {addressFields(bill, setBill, 'shipping')}
              <label className="opt" style={{ alignItems: 'center' }}><input type="checkbox" checked={diff} onChange={(e) => setDiff(e.target.checked)} /><div><b>Ship to a different address</b><small>Sending a gift? Add the recipient here.</small></div></label>
              <label className="opt" style={{ alignItems: 'center' }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><div><b>Remember my details on this device</b><small>Fills in your email and address next time. Leave this off on a shared device.</small></div></label>
              {diff ? addressFields(ship, setShip, 'section-gift shipping') : null}
              <label className="form-grid" style={{ display: 'flex' }}><span className="sr">Order note</span>
                <textarea className="field" placeholder="Order note (optional), e.g. gift wrap or delivery time" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </section>
            {quote?.shippingMethods.length ? (
              <section className="panel" role="radiogroup" aria-label="Delivery method">
                <h2>Delivery</h2>
                {quote.shippingMethods.map((s) => (
                  <label key={s.id} className={`opt ${shippingId === s.id ? 'on' : ''}`}>
                    <input type="radio" name="ship" checked={shippingId === s.id} onChange={() => setShippingId(s.id)} />
                    <div><b>{s.name}</b><small>{[s.description, s.estimatedDays].filter(Boolean).join(' · ')}</small></div>
                    <em>{s.cost ? money(s.cost) : 'Free'}</em>
                  </label>
                ))}
              </section>
            ) : null}
            <section className="panel" role="radiogroup" aria-label="Payment method">
              <h2>Payment</h2>
              {quote?.paymentMethods.map((m) => (
                <label key={m.id} className={`opt ${paymentId === m.id ? 'on' : ''}`}>
                  <input type="radio" name="pay" checked={paymentId === m.id} onChange={() => setPaymentId(m.id)} />
                  <div><b>{m.name}</b><small>{m.description}</small></div>
                  <em>{m.fee ? `+ ${money(m.fee)}` : ''}</em>
                </label>
              )) || <p className="hint">Loading payment options…</p>}
            </section>
          </div>
          <aside className="side">
            <div className="panel">
              <h2>Your order</h2>
              <div>
                {quote?.lines.map((l) => (
                  <div className="line" key={l.id + (l.variant || '')}>
                    <div className="line-info"><span style={{ color: 'var(--ink-hi)' }}>{l.name}</span><small>{l.variant ? `${l.variant} · ` : ''}× {l.quantity}</small></div>
                    <span className="price">{money(l.lineTotal)}</span>
                  </div>
                ))}
              </div>
              {quote?.problems.length ? <p className="notice error">{quote.problems.map((p) => p.message).join(' ')} <Link href="/cart">Edit your bag</Link></p> : null}
              <div className="coupon">
                <label className="sr" htmlFor="coupon">Coupon code</label>
                <input id="coupon" className="field" placeholder="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} />
                <button type="button" className="btn" style={{ minHeight: 46, padding: '0 16px' }} onClick={() => setCoupon(couponInput.trim())}>Apply</button>
              </div>
              {quote?.coupon ? <p className={`notice ${quote.coupon.valid ? '' : 'error'}`}>{quote.coupon.valid ? `${quote.coupon.code}: ${quote.coupon.message}` : quote.coupon.message}{quote.coupon.valid ? <> <button type="button" className="link-btn" onClick={() => { setCoupon(''); setCouponInput(''); }}>Remove</button></> : null}</p> : null}
              <div className="totals">
                <div><span>Subtotal</span><span>{quote ? money(quote.subtotal) : '…'}</span></div>
                {quote?.discount ? <div><span>Discount</span><span>− {money(quote.discount)}</span></div> : null}
                <div><span>Delivery</span><span>{quote ? (quote.shipping ? money(quote.shipping) : 'Free') : '…'}</span></div>
                {quote?.fee ? <div><span>Payment fee</span><span>{money(quote.fee)}</span></div> : null}
                <div className="grand"><span>Total</span><b>{quote ? money(quote.total) : '…'}</b></div>
              </div>
              <button className="btn btn-gold btn-block" type="submit" disabled={busy || !quote || !!quote.problems.length || !paymentId}>{busy ? 'Sealing your order…' : 'Place order'}</button>
              <p className="hint">Prices, stock and delivery are confirmed again when you place the order.</p>
            </div>
          </aside>
        </form>
        {payhere ? (
          <form ref={payForm} method="post" action={payhere.url}>
            {Object.entries(payhere.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <p className="lead">Taking you to the secure card payment page…</p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
