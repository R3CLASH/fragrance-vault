'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from './cart';
import { lockScroll, onFrame } from '@/lib/scroll';

const LINKS = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/shop', label: 'The Vault', key: 'shop' },
  { href: '/about-us', label: 'About', key: 'about' },
  { href: '/contact-us', label: 'Contact', key: 'contact' },
];

function Burger({ open, size = 18 }: { open: boolean; size?: number }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 9h14M5 15h14" /></svg>
  );
}
const Lock = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="9" width="16" height="12" rx="2" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /></svg>
);

export default function Nav({ logo, siteName, categories }: { logo: string; siteName: string; categories: { name: string; slug: string }[] }) {
  const path = usePathname() || '/';
  const { count, ready, setDrawer } = useCart();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState({ x: '90%', y: '40px' });
  const root = useRef<HTMLDivElement>(null);
  const hover = useRef<HTMLAnchorElement | null>(null);
  const active = path === '/' ? 'home' : path.startsWith('/shop') || path.startsWith('/product') ? 'shop' : path.startsWith('/about') ? 'about' : path.startsWith('/contact') ? 'contact' : '';

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    lockScroll('menu', open);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  // the bag pulses whenever something is locked into the vault
  useEffect(() => {
    const pulse = () => root.current?.querySelectorAll<HTMLElement>('[data-bag]').forEach((b) => {
      b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    });
    window.addEventListener('fv:added', pulse);
    return () => window.removeEventListener('fv:added', pulse);
  }, []);

  // scroll dial on the menu button, sliding marker
  useEffect(() => {
    const el = root.current; if (!el) return;
    const arcs = el.querySelectorAll<HTMLElement>('[data-arc]'), ticks = el.querySelectorAll<HTMLElement>('[data-ticks]');
    const bar = el.querySelector<HTMLElement>('.nav-bar'), marker = el.querySelector<HTMLElement>('.nav-marker');
    let deg0 = -1, solid: boolean | null = null, lastT: HTMLElement | null | undefined, lastW = 0;
    return onFrame((f) => {
      const p = Math.min(1, Math.max(0, f.y / f.limit)), deg = Math.round(p * 360);
      if (deg !== deg0) {
        deg0 = deg;
        arcs.forEach((a) => (a.style.background = `conic-gradient(#F6E27A ${deg}deg, transparent ${deg}deg)`));
        ticks.forEach((a) => (a.style.transform = `rotate(${p * 1080}deg)`));
      }
      if (solid !== f.y > 30) { solid = f.y > 30; bar?.classList.toggle('solid', solid); }
      const t = hover.current || el.querySelector<HTMLAnchorElement>('.nav-links a.on');
      if (marker && (t !== lastT || f.vw !== lastW)) {
        lastT = t; lastW = f.vw;
        if (t) { marker.style.left = t.offsetLeft + 'px'; marker.style.width = t.offsetWidth + 'px'; } else marker.style.width = '0px';
      }
    });
  }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2 + 'px', y: r.top + r.height / 2 + 'px' });
    setOpen((o) => !o);
  };
  const dial = (cls = '') => (
    <button type="button" className={`dial-btn ${cls}`} onClick={toggle} aria-expanded={open} aria-controls="site-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
      <span className="arc" data-arc /><span className="ticks" data-ticks /><span className="ico"><Burger open={open} size={cls ? 20 : 18} /></span>
    </button>
  );
  const bag = ready ? count : 0;
  // the bag opens as a drawer; the /cart link stays as the fallback (and for new-tab clicks)
  const openBag = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); setOpen(false); setDrawer(true);
  };

  return (
    <div ref={root}>
      <a href="#main" className="sr skip">Skip to content</a>
      <header className="nav-bar">
        <Link className="nav-logo" href="/" aria-label={`${siteName} home`}><img src={logo} alt={siteName} width={140} height={40} /></Link>
        <nav className="nav-links" aria-label="Main" onMouseLeave={() => (hover.current = null)}>
          {LINKS.map((l) => (
            <Link key={l.key} href={l.href} className={active === l.key ? 'on' : ''} onMouseEnter={(e) => (hover.current = e.currentTarget)}>{l.label}</Link>
          ))}
          <span className="nav-marker" aria-hidden="true" />
        </nav>
        <div className="nav-right">
          <Link className="nav-bag" data-bag href="/cart" onClick={openBag} aria-haspopup="dialog" aria-label={`Your vault, ${bag} items`}><Lock /><span>Vault · {bag}</span></Link>
          {dial()}
        </div>
      </header>

      <header className="nav-top">
        <Link href="/" aria-label={`${siteName} home`}><img src={logo} alt={siteName} width={126} height={36} /></Link>
      </header>
      <nav className="dock" aria-label="Quick links">
        <Link href="/" className={active === 'home' ? 'on' : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4z" /></svg><span>Home</span>
        </Link>
        <Link href="/shop" className={active === 'shop' ? 'on' : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="12" cy="12" r="3.5" /></svg><span>Vault</span>
        </Link>
        <div className="mid">{dial('big')}</div>
        <Link href="/contact-us" className={active === 'contact' ? 'on' : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 7 8.5-7" /></svg><span>Contact</span>
        </Link>
        <Link href="/cart" data-bag onClick={openBag} aria-haspopup="dialog" aria-label={`Bag, ${bag} items`}><Lock s={20} /><span>Bag · {bag}</span></Link>
      </nav>

      <div id="site-menu" data-lenis-prevent className={`menu ${open ? 'open' : ''}`} style={{ ['--ox' as string]: origin.x, ['--oy' as string]: origin.y }} aria-hidden={!open}>
        <div className="menu-dial" />
        <nav aria-label="Menu">
          <span className="eyebrow" style={{ marginBottom: 14 }}>Choose a door</span>
          {[{ href: '/', t: 'Home' }, { href: '/shop', t: 'The Vault' }, { href: '/cart', t: `Your bag (${bag})` }, { href: '/about-us', t: 'About us' }, { href: '/contact-us', t: 'Contact' }].map((l, i) => (
            <Link key={l.href} href={l.href} style={{ ['--i' as string]: i }} tabIndex={open ? 0 : -1} onClick={l.href === '/cart' ? openBag : () => setOpen(false)}>
              <span>0{i + 1}</span>{l.t}
            </Link>
          ))}
          <div className="menu-chips">
            {categories.slice(0, 6).map((c) => (
              <Link key={c.slug} className="chip" href={`/shop?category=${c.slug}`} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>{c.name}</Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
