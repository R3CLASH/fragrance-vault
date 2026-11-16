import HomeExperience from '@/components/HomeExperience';
import { getHome, getProducts } from '@/lib/strapi';

export const revalidate = 60;

export default async function HomePage() {
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
  return <HomeExperience home={home} boxes={boxes} />;
}
