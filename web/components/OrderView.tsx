'use client';

import Link from 'next/link';
import { marked } from 'marked';
import { useMemo } from 'react';
import { money } from '@/lib/format';
import { media } from '@/lib/store-client';

export type PublicOrder = {
  orderNumber: string; status: string; paymentStatus: string; createdAt: string; email: string;
  billing: any; shippingAddress: any;
  items: { name: string; variant: string | null; quantity: number; unitPrice: number; lineTotal: number; image: string | null; slug: string | null }[];
  subtotal: number; discount: number; shipping: number; fee: number; total: number; couponCode: string | null;
  paymentMethod: string; paymentType: string; shippingMethod: string | null; courier: string | null; trackingNumber: string | null; trackingUrl: string | null;
  history: { status: string; note: string; at: string }[];
  payment?: { type: string; name: string; instructions?: string | null; redirect?: { url: string; fields: Record<string, string> } | null };
};

const LABEL: Record<string, string> = { pending_payment: 'Awaiting payment', on_hold: 'On hold', processing: 'Processing', shipped: 'Shipped', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Refunded', failed: 'Payment failed' };
const STEPS = ['Placed', 'Paid', 'Packed', 'Shipped', 'Delivered'];
function stepOf(o: PublicOrder) {
  if (o.status === 'completed') return 4;
  if (o.status === 'shipped') return 3;
  if (o.status === 'processing') return o.paymentStatus === 'paid' ? 2 : 1;
  return o.paymentStatus === 'paid' ? 1 : 0;
}

export default function OrderView({ o, fresh }: { o: PublicOrder; fresh?: boolean }) {
  const instructions = useMemo(() => (o.payment?.instructions ? (marked.parse(o.payment.instructions, { breaks: true }) as string) : null), [o.payment]);
  const ended = ['cancelled', 'refunded', 'failed'].includes(o.status);
  const s = stepOf(o);
  const addr = o.shippingAddress || o.billing || {};
  return (
    <div className="split">
      <div className="main">
        <section className="panel">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2>Order {o.orderNumber}</h2>
            <span className="status">{LABEL[o.status] || o.status}</span>
          </div>
          {fresh ? <p className="lead">Thank you. Your order is in the vault, and a confirmation is on its way to {o.email}.</p> : null}
          {!ended ? (
            <ol className="progress" aria-label={`Progress: ${STEPS[s]}`}>
              {STEPS.map((x, i) => <li key={x} className={i <= s ? 'on' : ''}><i aria-hidden="true" /><span>{x}</span></li>)}
            </ol>
          ) : null}
          {o.trackingNumber ? (
            <p className="notice">Shipped with {o.courier || 'our courier'}: <b>{o.trackingNumber}</b>{o.trackingUrl ? <> · <a href={o.trackingUrl}>Track the parcel</a></> : null}</p>
          ) : null}
        </section>

        {o.payment && o.paymentStatus !== 'paid' && !ended ? (
          <section className="panel">
            <h2>How to pay</h2>
            {o.payment.redirect ? (
              <form method="post" action={o.payment.redirect.url}>
                {Object.entries(o.payment.redirect.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <p className="lead">Your card payment has not gone through yet.</p>
                <button className="btn btn-gold" type="submit">Pay {money(o.total)} now</button>
              </form>
            ) : instructions ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: instructions }} />
            ) : (
              <p className="lead">We will contact you to complete the payment.</p>
            )}
          </section>
        ) : null}

        <section className="panel" style={{ gap: 0 }}>
          <h2 style={{ marginBottom: 8 }}>Items</h2>
          {o.items.map((i, k) => (
            <div className="line" key={k}>
              <div className="line-img">{i.image ? <img src={media(i.image) || ''} alt="" /> : null}</div>
              <div className="line-info">
                {i.slug ? <Link href={`/product/${i.slug}`}>{i.name}</Link> : <span style={{ color: 'var(--ink-hi)' }}>{i.name}</span>}
                <small>{i.variant ? `${i.variant} · ` : ''}{money(i.unitPrice)} × {i.quantity}</small>
              </div>
              <span className="price">{money(i.lineTotal)}</span>
            </div>
          ))}
        </section>

        {o.history.length ? (
          <section className="panel">
            <h2>History</h2>
            {o.history.slice().reverse().map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, justifyContent: 'space-between', borderBottom: '1px solid rgba(212,175,55,.14)', paddingBottom: 10 }}>
                <span style={{ color: 'var(--mute)' }}>{h.note}</span>
                <small style={{ color: 'var(--dim)', whiteSpace: 'nowrap' }}>{new Date(h.at).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </div>
            ))}
          </section>
        ) : null}
      </div>
      <aside className="side">
        <div className="panel">
          <h2>Summary</h2>
          <div className="totals">
            <div><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
            {o.discount ? <div><span>Discount{o.couponCode ? ` (${o.couponCode})` : ''}</span><span>− {money(o.discount)}</span></div> : null}
            <div><span>Delivery</span><span>{o.shipping ? money(o.shipping) : 'Free'}</span></div>
            {o.fee ? <div><span>Payment fee</span><span>{money(o.fee)}</span></div> : null}
            <div className="grand"><span>Total</span><b>{money(o.total)}</b></div>
          </div>
          <div className="kv">
            <div><span>Payment</span>{o.paymentMethod} · {o.paymentStatus === 'paid' ? 'Paid' : 'Not paid yet'}</div>
            {o.shippingMethod ? <div><span>Delivery</span>{o.shippingMethod}</div> : null}
            <div><span>Deliver to</span>{[`${addr.firstName || ''} ${addr.lastName || ''}`.trim(), addr.address1, addr.address2, addr.city, addr.district].filter(Boolean).join(', ')}</div>
            <div><span>Placed</span>{new Date(o.createdAt).toLocaleDateString('en-LK', { dateStyle: 'long' })}</div>
          </div>
          <Link className="btn btn-block" href="/shop">Keep browsing</Link>
        </div>
      </aside>
    </div>
  );
}
