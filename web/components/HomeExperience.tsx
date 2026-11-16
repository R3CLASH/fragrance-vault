'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { Home, Product } from '@/lib/strapi';
import { money } from '@/lib/format';
import { particleCloud, vaultTunnel } from '@/lib/engines';
import { onFrame, type Frame } from '@/lib/scroll';
import { drawerSwing } from './Motion';
import ProductCard from './ProductCard';

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ez = (v: number) => v * v * (3 - 2 * v);
const ROMAN = ['I', 'II', 'III'];

export default function HomeExperience({ home, boxes }: { home: Home; boxes: Product[] }) {
  const root = useRef<HTMLDivElement>(null);
  const hero = home.featuredProduct;
  const words = home.marqueeWords;
  const marquee = (words ? words.split(',') : boxes.map((b) => b.brand?.name || b.name)).map((w) => w.trim()).filter(Boolean);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const $ = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector<T>(s) as T;
    const $$ = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
    const heroEl = $('[data-pin=hero]'), heroS = $('[data-stick=hero]'), iris = $('[data-iris]'), ring = $('[data-ring]');
    const combo = $('[data-pin=combo]'), comboS = $('[data-stick=combo]'), scene = $('[data-scene]'), dial = $('[data-dial]');
    const cta = $('[data-cta]'), sh = $('[data-sh]'), mq = $('[data-mq]'), c2 = $('.ch2');
    const small = window.innerWidth < 700;
    const T = vaultTunnel($<HTMLCanvasElement>('#tunnel'), small ? 1100 : 1800, () => $<HTMLImageElement>('#heroImg'));
    const B = particleCloud($<HTMLCanvasElement>('#comboCv'), 'dust', small ? 900 : 1300);
    const shapes = ['dust', 'wheel', 'bottle'];
    const chs = $$('[data-ch]'), c2c = c2.firstElementChild as HTMLElement, bars = $$('.bars i'), shs = Array.from(sh.children) as HTMLElement[];
    let H = 0, W = 0, step = -1, idle = 0;
    // measurements taken in the read phase, used in the write phase
    let hr = { top: 0, height: 1 }, tt = 0, ir = { top: 0, width: 0 }, cr = { top: 0, height: 1 }, ctaTop = 0;
    const onMove = (e: MouseEvent) => { T.mx = e.clientX / window.innerWidth - 0.5; T.my = e.clientY / window.innerHeight - 0.5; };
    heroS.addEventListener('mousemove', onMove);

    const read = () => {
      const a = heroEl.getBoundingClientRect(), b = iris.getBoundingClientRect(), c = combo.getBoundingClientRect();
      hr = { top: a.top, height: a.height }; ir = { top: b.top, width: b.width }; cr = { top: c.top, height: c.height };
      tt = c2c.getBoundingClientRect().top - heroS.getBoundingClientRect().top;
      ctaTop = cta.getBoundingClientRect().top;
    };

    const write = (f: Frame) => {
      // keep the pinned lengths stable while a phone's address bar slides in and out
      if (!H || f.vw !== W || Math.abs(f.vh - H) > 120) {
        H = f.vh; W = f.vw; idle = 0;
        heroEl.style.height = H * 3.8 + 'px'; heroS.style.height = H + 'px';
        combo.style.height = H * 3 + 'px'; comboS.style.height = H + 'px'; iris.style.marginTop = -H + 'px';
        return; // measure again next frame with the new heights
      }
      // nothing moved and the marquee skew has settled: skip the frame
      if (f.dy === 0 && Math.abs(f.v) < 0.05) { if (++idle > 2) return; } else idle = 0;

      const ph = cl(-hr.top / Math.max(1, hr.height - H));
      T.p = cl(ph / 0.5); T.tt = tt;
      const o = [1 - cl((ph - 0.04) / 0.1), cl((ph - 0.19) / 0.06) * (1 - cl((ph - 0.34) / 0.07)), cl((ph - 0.46) / 0.08)];
      const sc = [1 + (1 - o[0]) * 1.6, 0.75 + 0.25 * cl((ph - 0.19) / 0.06) + cl((ph - 0.34) / 0.07) * 1.2, 1];
      chs.forEach((c, i) => { c.style.opacity = String(o[i]); c.style.visibility = o[i] < 0.02 ? 'hidden' : 'visible'; c.style.transform = sc[i] === 1 ? '' : `scale(${sc[i]})`; });

      // iris: the next section opens through a widening aperture, only after the bottle has had its moment
      const pi = cl((H - ir.top) / H / 0.85 - 0.15 / 0.85);
      if (pi >= 1) { iris.style.clipPath = ''; ring.style.opacity = '0'; }
      else {
        const r = ez(pi) * Math.hypot(ir.width, H) * 0.56, cyL = H / 2 - ir.top;
        iris.style.clipPath = `circle(${r}px at 50% ${cyL}px)`;
        ring.style.opacity = String(cl((r - 50) / 90));
        ring.style.width = ring.style.height = r * 2 + 'px';
        ring.style.transform = `translate3d(${ir.width / 2 - r}px, ${cyL - r}px, 0)`;
        (ring.firstElementChild as HTMLElement).style.transform = `rotate(${pi * 220}deg)`;
      }

      mq.style.transform = `translate3d(${-f.y * 0.12}px, 0, 0) skewX(${Math.max(-24, Math.min(24, f.v * -0.5))}deg)`;

      const pc = cl(-cr.top / Math.max(1, cr.height - H)), en = cl(1 - cr.top / H);
      scene.style.opacity = String(en); scene.style.transform = en >= 1 ? '' : `perspective(1200px) rotateX(${(1 - en) * 55}deg) scale(${0.7 + 0.3 * en})`;
      dial.style.transform = `rotate(${-(pc - 1 / 6) * 360}deg)`;
      const s = pc < 1 / 3 ? 0 : pc < 2 / 3 ? 1 : 2;
      if (s !== step) {
        step = s; B.to(shapes[s]);
        $('#stepLabel').textContent = `${ROMAN[s]} · ${home.steps[s]?.label || ''}`;
        $('#stepBody').textContent = home.steps[s]?.body || '';
        bars.forEach((b, i) => b.classList.toggle('on', i <= s));
      }
      if (f.dy) B.ry += f.dy * 0.004;

      const pt = cl((H * 0.92 - ctaTop) / (H * 0.6));
      sh.style.opacity = pt >= 1 ? '0' : '1';
      shs.forEach((c, i) => (c.style.transform = `rotateY(${cl(pt * 1.7 - i * 0.09) * 90}deg)`));
    };
    const offFrame = onFrame(write, read);
    const offDrawers = drawerSwing(() => $$('[data-dr]'));
    return () => { offFrame(); offDrawers(); T.stop(); B.stop(); heroS.removeEventListener('mousemove', onMove); };
  }, [home.steps]);

  return (
    <div ref={root} className="home">
      <section className="hero" data-pin="hero">
        <div className="hero-stick" data-stick="hero">
          <canvas className="fill" id="tunnel" aria-hidden="true" />
          {hero?.image ? <img id="heroImg" src={hero.image.url} alt="" style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 2, opacity: 0 }} /> : null}
          <div className="ch ch0" data-ch="0">
            <div className="eyebrow rule">{home.heroEyebrow}</div>
            <h1>{home.heroTitle} <span className="gold-text">{home.heroHighlight}</span></h1>
            <p className="lead">{home.heroText}</p>
            <Link className="btn" href="/shop">Skip to the shop</Link>
            <div className="cue" aria-hidden="true"><span>SCROLL</span><i /></div>
          </div>
          <div className="ch ch1" data-ch="1" aria-hidden="true">
            <span className="eyebrow">{home.chapterEyebrow}</span>
            <p className="big">{home.chapterTitle}</p>
            <p className="lead">{home.chapterText}</p>
          </div>
          <div className="ch ch2" data-ch="2">
            {hero ? (
              <>
                <span className="eyebrow" style={{ color: '#9fd4ff', textShadow: '0 0 20px #050505' }}>Found in the vault{hero.brand ? ` · ${hero.brand.name}` : ''}</span>
                <p className="name">{hero.name}</p>
                <span className="price">{money(hero.current)}</span>
                <div className="row">
                  <Link className="btn btn-gold" href="/shop">Enter the shop</Link>
                  <Link className="btn" href={`/product/${hero.slug}`}>See this scent</Link>
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">Found in the vault</span>
                <div className="row"><Link className="btn btn-gold" href="/shop">Enter the shop</Link></div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="iris" data-iris>
        <div className="iris-ring" data-ring aria-hidden="true"><i /></div>
        <div className="wrap section">
          <div className="sec-head">
            <div><span className="eyebrow">{home.boxesEyebrow}</span><h2>{home.boxesTitle}</h2></div>
            <Link className="more" href="/shop">View all boxes</Link>
          </div>
          <div className="cards">
            {boxes.map((p, i) => <div className="drawer" data-dr key={p.id}><div><ProductCard p={p} i={i} /></div></div>)}
          </div>
        </div>
        <div className="marquee" aria-hidden="true">
          <div data-mq>{[0, 1, 2, 3].flatMap((k) => marquee.map((w, i) => <span key={`${k}-${i}`}>{w}</span>))}</div>
        </div>
      </section>

      <section className="combo" data-pin="combo">
        <div className="combo-stick" data-stick="combo">
          <div className="wrap combo-scene" data-scene>
            <div className="dial-wrap" aria-hidden="true">
              <div className="dial" data-dial><b>I</b><b>II</b><b>III</b></div>
              <div className="dial-pointer" />
              <canvas id="comboCv" />
            </div>
            <div className="combo-text">
              <span className="eyebrow">{home.comboEyebrow}</span>
              <h2>{home.comboTitle}</h2>
              <div className="combo-step" aria-live="polite">
                <span id="stepLabel">I · {home.steps[0]?.label}</span>
                <p className="lead" id="stepBody">{home.steps[0]?.body}</p>
              </div>
              <div className="bars" aria-hidden="true"><i className="on" /><i /><i /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta" data-cta>
        <div className="wrap cta-in">
          <div className="spinner" aria-hidden="true" />
          <h2>{home.ctaTitle}</h2>
          <p className="lead">{home.ctaText}</p>
          <Link className="btn btn-gold" href="/shop">{home.ctaLabel}</Link>
        </div>
        <div className="shutters" data-sh aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>
      </section>
    </div>
  );
}
