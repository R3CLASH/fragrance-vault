import { timingSafeEqual } from 'crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Point a Strapi webhook (Settings → Webhooks) at /api/revalidate?secret=YOUR_SECRET so edits show up instantly.
// The secret can also be sent as an "x-revalidate-secret" header, which keeps it out of server logs.
export async function POST(req: Request) {
  const expected = process.env.REVALIDATE_SECRET || '';
  const given = req.headers.get('x-revalidate-secret') || new URL(req.url).searchParams.get('secret') || '';
  if (!expected || expected === 'change-me' || !same(given, expected)) return NextResponse.json({ ok: false }, { status: 401 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, revalidated: true });
}
