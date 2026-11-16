import { STRAPI_URL } from '@/lib/strapi';

// Strapi uploads, served from this site's own origin (/media/...).
// Same-origin images keep the canvas "particle bottle" effect working and avoid CORS setup.
// Uploads have hashed file names, so browsers may cache them for a year.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.some((p) => p === '..' || p === '.')) return new Response('Not found', { status: 404 });
  const res = await fetch(`${STRAPI_URL}/uploads/${path.map(encodeURIComponent).join('/')}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok || !res.body) return new Response('Not found', { status: res?.status === 404 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
