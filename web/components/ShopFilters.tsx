'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Opt = { value: string; label: string; short?: string }; // short: what a phone-width trigger shows
type SP = { category?: string; brand?: string; gender?: string; q?: string; sort?: string };

const SORTS: Opt[] = [{ value: '', label: 'Newest' }, { value: 'price-asc', label: 'Price: low to high', short: 'Price ↑' }, { value: 'price-desc', label: 'Price: high to low', short: 'Price ↓' }, { value: 'name', label: 'Name', short: 'A–Z' }];

function href(sp: SP, patch: Partial<SP>) {
  const next = { ...sp, ...patch };
  const qs = Object.entries(next).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
  return `/shop${qs ? `?${qs}` : ''}`;
}

/**
 * One filter as a combination-lock tumbler: the trigger's dial turns to the option you point at,
 * and the open panel lists every position on the lock.
 */
function Tumbler({ name, param, options, sp, open, onOpen }: { name: string; param: keyof SP; options: Opt[]; sp: SP; open: boolean; onOpen: (o: boolean) => void }) {
  const current = sp[param] || '';
  const sel = Math.max(0, options.findIndex((o) => o.value === current));
  const [aim, setAim] = useState(sel);
  const step = 360 / Math.max(options.length, 1);
  const root = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const shown = options.length > 8 && q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;

  useEffect(() => { setAim(sel); }, [sel, open]);
  useEffect(() => {
    if (!open) { setQ(''); return; }
    // with a mouse, jump into the finder; on touch, focusing it would throw up the keyboard
    const finder = window.matchMedia('(hover: hover)').matches ? '[role=menu] input, ' : '';
    const first = root.current?.querySelector<HTMLElement>(`${finder}[role=menuitemradio][aria-checked=true]`);
    first?.focus({ preventScroll: true });
  }, [open]);

  const keys = (e: React.KeyboardEvent) => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') || []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      n?.focus();
    } else if (e.key === 'Escape') {
      onOpen(false); root.current?.querySelector<HTMLElement>('.tum-btn')?.focus();
    }
  };

  return (
    <div ref={root} className={`tum${open ? ' open' : ''}${current ? ' set' : ''}`} onKeyDown={keys}>
      <button type="button" className="tum-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => onOpen(!open)}>
        <span className="tum-dial" aria-hidden="true" style={{ ['--a' as string]: `${-aim * step}deg` }}><i /></span>
        <span className="tum-text">
          <small>{name}</small>
          <b><span className="tum-full">{options[sel]?.label}</span><span className="tum-short">{options[sel]?.short || options[sel]?.label}</span></b>
        </span>
        <svg className="tum-car" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="tum-panel" role="menu" aria-label={name} data-lenis-prevent>
        {options.length > 8 ? (
          <input className="tum-find" type="search" placeholder={`Find a ${name.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Find a ${name.toLowerCase()}`} />
        ) : null}
        <div className="tum-list">
          {shown.map((o) => {
            const i = options.indexOf(o);
            return (
              <Link key={o.value || 'all'} role="menuitemradio" aria-checked={i === sel} className={i === sel ? 'on' : ''} href={href(sp, { [param]: o.value || undefined })} scroll={false}
                onMouseEnter={() => setAim(i)} onFocus={() => setAim(i)} onClick={() => onOpen(false)}>
                <em>{String(i).padStart(2, '0')}</em>{o.label}
              </Link>
            );
          })}
          {!shown.length ? <span className="tum-none">No match</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function ShopFilters({ sp, categories, brands, count }: { sp: SP; categories: { name: string; slug: string }[]; brands: { name: string; slug: string }[]; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!bar.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const tum = (name: string, param: keyof SP, options: Opt[]) => (
    <Tumbler name={name} param={param} options={options} sp={sp} open={open === name} onOpen={(o) => setOpen(o ? name : null)} />
  );
  const active = [
    sp.category && { key: 'category', label: categories.find((c) => c.slug === sp.category)?.name || sp.category },
    sp.brand && { key: 'brand', label: brands.find((b) => b.slug === sp.brand)?.name || sp.brand },
    sp.gender && { key: 'gender', label: sp.gender.replace('-', ' ') },
    sp.q && { key: 'q', label: `“${sp.q}”` },
  ].filter(Boolean) as { key: keyof SP; label: string }[];

  return (
    <div className="lockbar">
      <div className="wrap">
        <div className="lockbar-row" ref={bar}>
          {tum('Range', 'category', [{ value: '', label: 'Every range', short: 'All' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))])}
          {tum('House', 'brand', [{ value: '', label: 'Every house', short: 'All' }, ...brands.map((b) => ({ value: b.slug, label: b.name }))])}
          {tum('Order', 'sort', SORTS)}
          <form className="lock-search" role="search" onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get('q') as string; router.push(href(sp, { q: q.trim() || undefined }), { scroll: false }); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
            <label className="sr" htmlFor="q">Search perfumes</label>
            <input id="q" name="q" type="search" placeholder="Search the vault" defaultValue={sp.q || ''} key={sp.q || ''} />
          </form>
          <span className="lock-count" aria-live="polite"><b>{String(count).padStart(2, '0')}</b>{count === 1 ? 'box' : 'boxes'}</span>
        </div>
        {active.length ? (
          <div className="lock-tags">
            {active.map((a) => (
              <Link key={a.key} className="lock-tag" href={href(sp, { [a.key]: undefined })} scroll={false} aria-label={`Remove ${a.label}`}>
                {a.label}<span aria-hidden="true">×</span>
              </Link>
            ))}
            {active.length > 1 ? <Link className="lock-clear" href={sp.sort ? `/shop?sort=${sp.sort}` : '/shop'} scroll={false}>Reset the lock</Link> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
