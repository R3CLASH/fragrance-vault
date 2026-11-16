'use client';

import { useEffect, useRef } from 'react';
import { onFrame } from '@/lib/scroll';

const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ez = (v: number) => v * v * (3 - 2 * v);

/**
 * Drives the deposit-drawer swing for every `el` (its first child is what moves).
 * Measures all wrappers first, then writes, and only does work while the page is scrolling.
 */
export function drawerSwing(els: () => HTMLElement[]): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let tops: number[] = [], H = 0, dirty = true, checked = 0;
  return onFrame(
    () => {
      if (!dirty) return;
      els().forEach((el, i) => {
        const c = el.firstElementChild as HTMLElement | null; if (!c) return;
        const p = ez(cl((H * 0.98 - tops[i]) / (H * 0.5)));
        if ((el as any)._p === p) return; (el as any)._p = p;
        const dir = i % 2 ? 1 : -1;
        c.style.opacity = p >= 1 ? '' : String(p); c.style.transformOrigin = dir < 0 ? '0% 50%' : '100% 50%';
        c.style.transform = p >= 1 ? '' : `perspective(1100px) translateZ(${(1 - p) * -420}px) rotateY(${(1 - p) * 72 * dir}deg)`;
        c.style.willChange = p > 0 && p < 1 ? 'transform, opacity' : '';
      });
    },
    (f) => {
      // also re-measure twice a second while idle, in case images loading in shifted the layout
      dirty = f.dy !== 0 || f.vh !== H || !tops.length || f.t - checked > 500;
      if (!dirty) return;
      H = f.vh; checked = f.t;
      tops = els().map((el) => el.getBoundingClientRect().top);
    },
  );
}

/** Children swing out of the wall like deposit-box drawers as they scroll into view. */
export function Drawers({ children, className = 'cards' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current; if (!root) return;
    return drawerSwing(() => Array.from(root.children) as HTMLElement[]);
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

/** Fade-and-tilt reveal for blocks of content (replays when scrolled back up). */
export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.classList.add('in');
      else if (e.boundingClientRect.top > 0) el.classList.remove('in');
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`rv ${className}`} style={{ ['--d' as string]: `${delay}s` }}>{children}</div>;
}
