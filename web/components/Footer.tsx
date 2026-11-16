'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { Global } from '@/lib/strapi';
import { onFrame, scrollToY } from '@/lib/scroll';

export default function Footer({ logo, global: g, pages, categories }: { logo: string; global: Global; pages: { title: string; slug: string }[]; categories: { name: string; slug: string }[] }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const f = ref.current; if (!f) return;
    const q = <T extends HTMLElement>(s: string) => f.querySelector<T>(s);
    const wm = q('.wordmark'), l = q('.seal-row .l'), r = q('.seal-row .r'), lock = q('.seal-lock'), word = q('.seal-word');
    let top = 0, h = 1, vis = false, e0 = -1;
    const io = new IntersectionObserver(([en]) => { vis = en.isIntersecting; }, { rootMargin: '10% 0px' });
    io.observe(f);
    const off = onFrame(
      (fr) => {
        if (!vis) return;
        const p = Math.min(1, Math.max(0, (fr.vh - top) / Math.max(1, h))), e = p * p * (3 - 2 * p);
        if (e === e0) return; e0 = e;
        if (wm) { wm.style.opacity = String(0.12 + 0.88 * e); wm.style.transform = `translate3d(0, ${(1 - e) * 45}%, 0) scaleX(${1 + (1 - e) * 0.35})`; }
        if (l && r) l.style.transform = r.style.transform = `scaleX(${e})`;
        if (lock) lock.style.transform = `rotate(${(1 - e) * -270}deg) scale(${0.6 + 0.4 * e})`;
        if (word) word.style.opacity = String(Math.min(1, Math.max(0, (p - 0.85) / 0.15)));
      },
      () => { if (vis) { const rc = f.getBoundingClientRect(); top = rc.top; h = rc.height; } },
    );
    return () => { off(); io.disconnect(); };
  }, []);

  const social = [['Instagram', g.instagram], ['Facebook', g.facebook], ['TikTok', g.tiktok]].filter(([, u]) => u) as [string, string][];
  return (
    <footer className="site-footer" ref={ref}>
      <div className="wrap foot-top">
        <div className="foot-brand">
          <img src={logo} alt={g.siteName} width={168} height={48} />
          <p>{g.footerText}</p>
          {g.contactPhone || g.contactEmail || g.whatsapp ? (
            <p style={{ fontSize: 15 }}>
              {g.whatsapp ? <>WhatsApp <a href={`https://wa.me/${g.whatsapp.replace(/\D/g, '')}`}>{g.whatsapp}</a><br /></> : null}
              {g.contactPhone ? <>Phone {g.contactPhone}<br /></> : null}
              {g.contactEmail ? <>Email {g.contactEmail}</> : null}
            </p>
          ) : null}
        </div>
        <nav className="foot-col" aria-label="The vault">
          <span className="eyebrow">The vault</span>
          <Link href="/shop">All perfumes</Link>
          {categories.slice(0, 5).map((c) => <Link key={c.slug} href={`/shop?category=${c.slug}`}>{c.name}</Link>)}
        </nav>
        <nav className="foot-col" aria-label="The house">
          <span className="eyebrow">The house</span>
          {pages.slice(0, 6).map((p) => <Link key={p.slug} href={`/${p.slug}`}>{p.title}</Link>)}
          {social.map(([n, u]) => <a key={n} href={u}>{n}</a>)}
        </nav>
        <button type="button" className="to-top" onClick={() => scrollToY(0)} aria-label="Back to the top">
          <i aria-hidden="true" />
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          <span>Top</span>
        </button>
      </div>
      <div className="wrap seal" aria-hidden="true">
        <div className="seal-row">
          <span className="l" />
          <span className="seal-lock"><svg width="22" height="22" viewBox="0 0 24 24" fill="#F6E27A"><circle cx="12" cy="8.5" r="4" /><path d="M10 10h4l1.6 10h-7.2z" /></svg></span>
          <span className="r" />
        </div>
        <span className="seal-word">Vault sealed</span>
      </div>
      <div className="wordmark" aria-hidden="true">{g.siteName.toUpperCase()}</div>
      <div className="foot-bar">
        <div className="wrap"><span>© {new Date().getFullYear()} {g.siteName}</span><span>Secure insured shipping islandwide</span></div>
      </div>
    </footer>
  );
}
