import { NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

/** Forwards a store request to Strapi, so the browser only ever talks to this site. */
export async function forward(req: Request, path: string) {
  let body: unknown = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: { message: 'Invalid request.' } }, { status: 400 }); }
  try {
    const res = await fetch(`${STRAPI_URL}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': req.headers.get('x-forwarded-for') || '' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({ error: { message: 'The store did not respond properly.' } }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: { message: 'The store is not reachable right now. Please try again in a minute.' } }, { status: 503 });
  }
}
