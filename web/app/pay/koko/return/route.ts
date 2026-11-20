import { NextResponse } from 'next/server';
import { STRAPI_URL } from '@/lib/strapi';
import { SITE_URL } from '@/lib/format';

/**
 * Customers land here when they come back from Koko (paid, failed or cancelled).
 * Koko adds orderId / trnId / status to the address. Those come from the visitor's browser, so they
 * are never trusted: the CMS asks Koko's orderView API itself before marking anything paid.
 * Then the customer is sent to their order page, which shows the real status.
 */
const ORDER_NO = /^[A-Z0-9-]{4,40}$/;
const TOKEN = /^[a-f0-9]{16,80}$/;

async function handle(req: Request) {
  const url = new URL(req.url);
  let params = url.searchParams;
  if (req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    if (form) { const merged = new URLSearchParams(params); form.forEach((v, k) => { if (typeof v === 'string' && !merged.has(k)) merged.set(k, v); }); params = merged; }
  }
  const o = (params.get('o') || '').toUpperCase(), t = params.get('t') || '';
  if (!ORDER_NO.test(o) || !TOKEN.test(t)) return NextResponse.redirect(`${SITE_URL}/shop`, 303);

  const kokoOrderId = params.get('orderId') || '';
  const said = (params.get('status') || '').toUpperCase();
  let outcome = 'pending';
  try {
    const xff = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const res = await fetch(`${STRAPI_URL}/api/payments/koko/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff[xff.length - 1] || '' },
      body: JSON.stringify({ orderNumber: o, token: t, kokoOrderId }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (data?.paid) outcome = 'paid';
  } catch { /* the order page keeps checking, and Koko's server confirmation still arrives */ }
  if (outcome !== 'paid' && (params.get('cancelled') || /CANCEL|FAIL/.test(said))) outcome = 'cancelled';

  return NextResponse.redirect(`${SITE_URL}/order/${encodeURIComponent(o)}?token=${encodeURIComponent(t)}&koko=${outcome}`, 303);
}

export const GET = handle;
export const POST = handle;
export const dynamic = 'force-dynamic';
