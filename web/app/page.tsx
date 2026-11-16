import { connection } from 'next/server';
import HomeExperience from '@/components/HomeExperience';
import { getHome, getProducts } from '@/lib/strapi';

export default async function HomePage() {
  // Render on every visit instead of once at build time. A pre-built homepage was frozen with
  // no products whenever the CMS didn't answer during the build or a background refresh.
  // The CMS responses themselves are still cached for 30s in lib/strapi.ts, so this stays fast.
  await connection();

  const home = await getHome();
  let boxes = home.featuredProducts;
  if (boxes.length < 4) {
    const more = await getProducts({ featured: true, limit: 8 });
    const seen = new Set(boxes.map((b) => b.id));
    boxes = [...boxes, ...more.filter((p) => !seen.has(p.id))].slice(0, 4);
  }
  if (boxes.length < 4) {
    const latest = await getProducts({ limit: 8 });
    const seen = new Set(boxes.map((b) => b.id));
    boxes = [...boxes, ...latest.filter((p) => !seen.has(p.id))].slice(0, 4);
  }
  // No hero product picked in the CMS (or it was deleted/unpublished): use the first box.
  if (!home.featuredProduct && boxes[0]) home.featuredProduct = boxes[0];
  return <HomeExperience home={home} boxes={boxes} />;
}
