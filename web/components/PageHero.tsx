'use client';

import { useEffect, useRef } from 'react';
import { onFrame } from '@/lib/scroll';

/** Page opener: copy on the left, a vault door on the right whose wheel turns as you scroll. */
export default function PageHero({ eyebrow, title, highlight, lead, plate, children }: { eyebrow: string; title: string; highlight: string; lead: string; plate: string; children?: React.ReactNode }) {
  const door = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = door.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const wheel = el.querySelector<HTMLElement>('.door-wheel'), ring = el.querySelector<HTMLElement>('.door-ring');
    let y0 = -1;
    return onFrame((f) => {
      if (f.y === y0 || f.y > f.vh * 1.2) return; y0 = f.y;
      if (wheel) wheel.style.transform = `rotate(${f.y * 0.35}deg)`;
      if (ring) ring.style.transform = `rotate(${f.y * -0.12}deg)`;
    });
  }, []);
  return (
    <section className="phero">
      <div className="wrap phero-in">
        <div className="phero-copy">
          <span className="eyebrow rule">{eyebrow}</span>
          <h1>{title} <span className="gold-text">{highlight}</span></h1>
          <p className="lead">{lead}</p>
          {children ? <div className="row phero-cta">{children}</div> : null}
        </div>
        <div className="door" ref={door} aria-hidden="true">
          <div className="door-ring" />
          <div className="door-face">
            <div className="door-wheel"><i /><i /><i /><b /></div>
          </div>
          <span className="door-plate">{plate}</span>
          <span className="door-hinge" /><span className="door-hinge" />
        </div>
      </div>
    </section>
  );
}
