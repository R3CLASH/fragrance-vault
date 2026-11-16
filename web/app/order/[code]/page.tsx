'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import OrderView, { type PublicOrder } from '@/components/OrderView';
import { post } from '@/lib/store-client';

function Inner() {
  const { code } = useParams<{ code: string }>();
  const token = useSearchParams().get('token') || '';
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true, tries = 0;
    const load = async () => {
      const r = await post<PublicOrder>('/api/track', { orderNumber: code, token });
      if (!alive) return;
      if (r.data) setOrder(r.data); else setError(r.error);
      // after a card payment, the gateway's confirmation can arrive a few seconds later
      if (r.data && r.data.status === 'pending_payment' && tries++ < 6) setTimeout(load, 4000);
    };
    if (token) load(); else setError('This link is missing its access code. Open the link from your order email, or contact us and we will help.');
    return () => { alive = false; };
  }, [code, token]);
  return (
    <div className="page"><div className="wrap">
      <div className="page-head"><span className="eyebrow">Your order</span><h1>{order ? 'Locked in the vault' : 'Your order'}</h1></div>
      {error ? <div className="empty"><p className="notice error">{error}</p><Link className="btn" href="/contact-us">Contact us</Link></div> : order ? <OrderView o={order} fresh /> : <p className="lead">Opening your order…</p>}
    </div></div>
  );
}

export default function OrderPage() {
  return <Suspense fallback={<div className="page"><div className="wrap"><p className="lead">Opening your order…</p></div></div>}><Inner /></Suspense>;
}
