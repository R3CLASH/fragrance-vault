import { NextResponse } from 'next/server';
import { STRAPI_URL } from './strapi';

const MAX_BODY = 64 * 1024; // a full cart with addresses is a few KB; anything bigger is not a real order

// The visitor's real IP: Railway's edge appends it as the LAST X-Forwarded-For entry.
// Earlier entries can be typed by the client, so only the last one is passed on (the CMS rate-limits on it).
function clientIp(req: Request) {
  const xff = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || req.headers.get('x-real-ip') || '';
}

/** Forwards a store request to Strapi, so the browser only ever talks to this site. */
export async function forward(req: Request, path: string) {
  const type = req.headers.get('content-type') || '';
  if (!type.includes('application/json')) return NextResponse.json({ error: { message: 'Invalid request.' } }, { status: 415 });
  const raw = await req.text().catch(() => '');
  if (raw.length > MAX_BODY) return NextResponse.json({ error: { message: 'Request too large.' } }, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: { message: 'Invalid request.' } }, { status: 400 }); }
  try {
    const res = await fetch(`${STRAPI_URL}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp(req) },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({ error: { message: 'The store did not respond properly.' } }));
    const out = NextResponse.json(data, { status: res.status });
    const retry = res.headers.get('retry-after');
    if (retry) out.headers.set('Retry-After', retry);
    return out;
  } catch {
    return NextResponse.json({ error: { message: 'The store is not reachable right now. Please try again in a minute.' } }, { status: 503 });
  }
}
