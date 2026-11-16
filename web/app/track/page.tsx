'use client';

import { useState } from 'react';
import OrderView, { type PublicOrder } from '@/components/OrderView';
import { post } from '@/lib/store-client';

export default function Track() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await post<PublicOrder>('/api/track', { orderNumber: orderNumber.trim(), email: email.trim() });
    setOrder(r.data); setError(r.error); setBusy(false);
  };
  return (
    <div className="page"><div className="wrap">
      <div className="page-head"><span className="eyebrow">Track an order</span><h1>Where is my perfume?</h1>
        <p className="lead">Enter the order number from your confirmation email and the email address you used.</p></div>
      <form className="panel" onSubmit={submit} style={{ maxWidth: 620, marginBottom: 40 }}>
        <div className="form-grid">
          <label>Order number *<input className="field" required placeholder="FV-…" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} /></label>
          <label>Email *<input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        </div>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        <button className="btn btn-gold" type="submit" disabled={busy}>{busy ? 'Opening…' : 'Find my order'}</button>
      </form>
      {order ? <OrderView o={order} /> : null}
    </div></div>
  );
}
