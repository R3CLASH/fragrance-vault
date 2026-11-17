import type { Metadata } from 'next';
import Link from 'next/link';
import { marked } from 'marked';
import PageHero from '@/components/PageHero';
import ContactComposer from '@/components/ContactComposer';
import { Reveal } from '@/components/Motion';
import { getGlobal, getPage, getPages, getPaymentMethods } from '@/lib/strapi';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const pg = await getPage('contact-us');
  return { title: pg?.metaTitle || 'Contact us', description: pg?.metaDescription || 'Ask about a scent, a gift or an order. Reach Fragrance Vault on WhatsApp or by email.', alternates: { canonical: '/contact-us' } };
}

const ICONS: Record<string, React.ReactNode> = {
  WhatsApp: <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20zM9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.1 1.8.9-.4 1.6c-3.6.4-7.8-3.8-7.4-7.4L10.3 7l.9 1.8L10 10" />,
  Phone: <path d="M6.6 3.5l3 3-1.8 2.3a12 12 0 0 0 7.4 7.4l2.3-1.8 3 3-2.2 2.6C11.6 20 4 12.4 4 5.7z" />,
  Email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 7 8.5-7" /></>,
  Instagram: <><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r="0.6" /></>,
  Facebook: <path d="M14 8h3V4.5h-3c-2.2 0-3.6 1.5-3.6 3.8V11H8v3.5h2.4V21H14v-6.5h2.6l.5-3.5H14V9c0-.6.4-1 1-1" />,
  TikTok: <path d="M14 4c.4 2.4 1.9 3.9 4.5 4.2v3.2a7.6 7.6 0 0 1-4.4-1.4v5.6A5.3 5.3 0 1 1 8.8 10v3.3a2 2 0 1 0 1.9 2V4z" />,
};

export default async function Contact() {
  const [pg, g, pages, payments] = await Promise.all([getPage('contact-us'), getGlobal(), getPages(), getPaymentMethods()]);
  const note = await marked.parse(pg?.content || '');
  const channels = ([
    g.whatsapp && ['WhatsApp', g.whatsapp, `https://wa.me/${g.whatsapp.replace(/\D/g, '')}`, 'Fastest reply'],
    g.contactPhone && ['Phone', g.contactPhone, `tel:${g.contactPhone.replace(/[^\d+]/g, '')}`, 'Call the vault'],
    g.contactEmail && ['Email', g.contactEmail, `mailto:${g.contactEmail}`, 'Write to us'],
    g.instagram && ['Instagram', 'Follow the vault', g.instagram, 'New arrivals first'],
    g.facebook && ['Facebook', 'Join us', g.facebook, 'News and offers'],
    g.tiktok && ['TikTok', 'Watch the vault', g.tiktok, 'Scents in motion'],
  ].filter(Boolean)) as [string, string, string, string][];
  const returns = pages.find((p) => /ship|return/i.test(p.slug));
  const pay = payments.map((p) => p.name);

  const faq = [
    ['Are your perfumes authentic?', 'Yes. The vault only keeps genuine designer and Middle Eastern perfumes. If you ever have a doubt about a bottle, message us and we will help.'],
    ['Where do you deliver?', 'Islandwide, with secure insured shipping. Delivery options and fees are shown at checkout before you pay.'],
    ['How can I pay?', pay.length ? `You can pay with ${pay.join(', ')}. Choose your method at checkout.` : 'Choose the payment method that suits you at checkout.'],
    ['How do I follow my order?', 'After you order you get an email at every step, each with a link that shows your order and its delivery status.'],
    ['Can you help me choose a scent?', 'Gladly. Choose “Find my scent” below, tell us what you love, and we will suggest bottles from the vault.'],
  ];

  return (
    <div className="contact">
      <PageHero eyebrow="Contact" title="Speak to the" highlight="keepers." plate="The front desk"
        lead="A question about a scent, a gift or an order? Write to us and a real person from the vault will answer.">
        {channels[0] ? <a className="btn btn-gold" href={channels[0][2]} target={channels[0][2].startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{channels[0][0] === 'WhatsApp' ? 'Message on WhatsApp' : channels[0][3]}</a> : null}
        <a className="btn" href="#write">Write a letter</a>
      </PageHero>

      {channels.length ? (
        <section className="wrap section" style={{ paddingTop: 0 }}>
          <div className="keys">
            {channels.map(([label, value, href, sub], i) => (
              <Reveal key={label} delay={i * 0.08}>
                <a className="key" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                  <span className="key-ring" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONS[label]}</svg></span>
                  <span className="key-tag"><small>{label}</small><b>{value}</b><em>{sub}</em></span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section className="desk" id="write">
        <div className="wrap section">
          <div className="sec-head"><div><span className="eyebrow">The concierge</span><h2>Write to the vault</h2></div></div>
          {g.whatsapp || g.contactEmail ? (
            <ContactComposer whatsapp={g.whatsapp} email={g.contactEmail} siteName={g.siteName} />
          ) : (
            <div className="prose" dangerouslySetInnerHTML={{ __html: note }} />
          )}
        </div>
      </section>

      <section className="wrap section faq">
        <div className="story-side">
          <span className="eyebrow">Before you ask</span>
          <h2>Questions the vault <span className="gold-text">hears most</span></h2>
          {returns ? <Link className="more" href={`/${returns.slug}`}>{returns.title}</Link> : null}
        </div>
        <div className="acc">
          {faq.map(([q, a], i) => (
            <details key={q} open={i === 0}><summary>{q}</summary><div className="prose"><p>{a}</p></div></details>
          ))}
        </div>
      </section>

      <section className="cta">
        <div className="wrap cta-in">
          <div className="spinner" aria-hidden="true" />
          <h2>Rather look for yourself?</h2>
          <p className="lead">Every bottle is waiting behind its own door.</p>
          <Link className="btn btn-gold" href="/shop">Open the collection</Link>
        </div>
      </section>
    </div>
  );
}
