import type { Metadata } from 'next';
import Link from 'next/link';
import { marked } from 'marked';
import PageHero from '@/components/PageHero';
import { Reveal } from '@/components/Motion';
import { getBrands, getGlobal, getPage, getPaymentMethods, getProducts } from '@/lib/strapi';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const pg = await getPage('about-us');
  return { title: pg?.metaTitle || 'About us', description: pg?.metaDescription || 'Authentic designer and Middle Eastern perfumes, kept under lock and key and delivered islandwide.', alternates: { canonical: '/about-us' } };
}

const STEPS = [
  ['Choose your box', 'Browse the vault by range or house and pick the bottle that speaks to you.'],
  ['Lock it in', 'Check out with the payment method you prefer. Your confirmation arrives by email straight away.'],
  ['Insured on the road', 'Your perfume travels with secure insured shipping, anywhere on the island, with an email at every step.'],
  ['Break the seal', 'Open the box, find your signature, and come back when the next scent calls.'],
];

export default async function About() {
  const [pg, g, brands, products, payments] = await Promise.all([getPage('about-us'), getGlobal(), getBrands(), getProducts({ limit: 200 }), getPaymentMethods()]);
  const story = await marked.parse(pg?.content || '');
  const pay = payments.map((p) => p.name);

  return (
    <div className="about">
      <PageHero eyebrow={`About ${g.siteName}`} title="Perfume, kept under" highlight="lock and key." plate="No. 01 · The house"
        lead="We keep a vault of authentic designer and Middle Eastern perfumes, and open it to the whole island with secure insured delivery.">
        <Link className="btn btn-gold" href="/shop">Open the collection</Link>
        <Link className="btn" href="/contact-us">Speak to us</Link>
      </PageHero>

      <div className="ledger">
        <div className="wrap ledger-in">
          {[
            [String(products.length), 'bottles in the vault'],
            [String(brands.length), 'houses on the shelves'],
            ['100%', 'authentic perfumes'],
            ['Islandwide', 'insured delivery'],
          ].map(([n, t], i) => (
            <Reveal key={t} delay={i * 0.08} className="ledger-cell"><b>{n}</b><span>{t}</span></Reveal>
          ))}
        </div>
      </div>

      <section className="wrap section story">
        <div className="story-side">
          <span className="eyebrow">Our story</span>
          <h2>Why a <span className="gold-text">vault</span>?</h2>
          <p className="story-quote">“A great perfume deserves to be kept like a treasure, and opened like one.”</p>
        </div>
        <Reveal className="prose story-body"><div dangerouslySetInnerHTML={{ __html: story }} /></Reveal>
      </section>

      <section className="promise">
        <div className="wrap section">
          <div className="sec-head"><div><span className="eyebrow">The vault promise</span><h2>Three locks on every order</h2></div></div>
          <div className="locks">
            {[
              ['I', 'Authentic, always', 'Every bottle in the vault is the genuine article: designer and Middle Eastern houses, never imitations.'],
              ['II', 'Insured to your door', 'Secure insured shipping islandwide, with an email at every step from the vault to your hands.'],
              ['III', 'Pay your way', pay.length ? `Choose ${pay.length > 1 ? `${pay.slice(0, -1).join(', ')} or ${pay[pay.length - 1]}` : pay[0]} at checkout.` : 'Choose the payment method that suits you at checkout.'],
            ].map(([n, h, t], i) => (
              <Reveal key={n} delay={i * 0.1} className="lock-card">
                <span className="lock-num">{n}</span>
                <h3>{h}</h3>
                <p>{t}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="sec-head"><div><span className="eyebrow">From the vault to your door</span><h2>How a bottle reaches you</h2></div></div>
        <ol className="path">
          {STEPS.map(([h, t], i) => (
            <Reveal key={h} delay={i * 0.12} className="path-step">
              <span className="path-dot">{String(i + 1).padStart(2, '0')}</span>
              <h3>{h}</h3>
              <p>{t}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {brands.length ? (
        <section className="houses">
          <div className="wrap section">
            <div className="sec-head"><div><span className="eyebrow">On the shelves</span><h2>The houses we keep</h2></div><Link className="more" href="/shop">See every box</Link></div>
            <div className="house-grid">
              {brands.map((b, i) => (
                <Link key={b.slug} className="house" href={`/shop?brand=${b.slug}`} style={{ ['--i' as string]: i }}>
                  <span>{String(i + 1).padStart(2, '0')}</span>{b.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="cta">
        <div className="wrap cta-in">
          <div className="spinner" aria-hidden="true" />
          <h2>Your signature is behind one of these doors</h2>
          <p className="lead">Turn the dial, open a box, and find the scent that stays with you.</p>
          <div className="row"><Link className="btn btn-gold" href="/shop">Enter the vault</Link><Link className="btn" href="/contact-us">Ask for a recommendation</Link></div>
        </div>
      </section>
    </div>
  );
}
