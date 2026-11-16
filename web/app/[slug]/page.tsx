import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { getPage } from '@/lib/strapi';

export const revalidate = 60;
type P = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const pg = await getPage((await params).slug);
  return pg ? { title: pg.metaTitle || pg.title, description: pg.metaDescription || undefined, alternates: { canonical: `/${(await params).slug}` } } : { title: 'Not found' };
}

export default async function CmsPage({ params }: { params: P }) {
  const pg = await getPage((await params).slug);
  if (!pg) notFound();
  const html = await marked.parse(pg.content || '');
  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head"><span className="eyebrow">Fragrance Vault</span><h1>{pg.title}</h1></div>
        <div className="prose" style={{ paddingBottom: 100 }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
