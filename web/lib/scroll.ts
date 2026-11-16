'use client';
// One animation loop for the whole site: Lenis smooth scroll plus every scroll-driven effect.
// Subscribers get a `read` phase (measure the DOM) and a `write` phase (set styles), so a frame
// never interleaves measuring and writing, which is what forces the browser into extra layouts.

import Lenis from 'lenis';

export type Frame = { y: number; dy: number; v: number; limit: number; vw: number; vh: number; t: number };
type Sub = { read?: (f: Frame) => void; write: (f: Frame) => void };

const subs = new Set<Sub>();
let lenis: Lenis | null = null;
let raf = 0, lastY = -1, v = 0;

/** Run `write` every frame (after `read`, if given). Returns an unsubscribe function. */
export function onFrame(write: Sub['write'], read?: Sub['read']): () => void {
  const s: Sub = { write, read };
  subs.add(s);
  return () => { subs.delete(s); };
}

export const getLenis = () => lenis;

export function scrollToY(y: number, immediate = false) {
  if (lenis) lenis.scrollTo(y, { immediate, duration: immediate ? 0 : 1.4 });
  else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
}

const locks = new Set<string>();
/** Freeze page scrolling while any overlay (menu, bag drawer…) holds a lock under its own key. */
export function lockScroll(key: string, locked: boolean) {
  if (locked) locks.add(key); else locks.delete(key);
  const on = locks.size > 0;
  if (lenis) (on ? lenis.stop() : lenis.start());
  document.documentElement.style.overflow = on ? 'hidden' : '';
}

export function startScroll(): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, anchors: true });
  const loop = (t: number) => {
    lenis?.raf(t);
    const y = window.scrollY, dy = lastY < 0 ? 0 : y - lastY;
    lastY = y; v += (dy - v) * 0.15;
    const f: Frame = {
      y, dy, v, t,
      vw: window.innerWidth, vh: window.innerHeight,
      limit: lenis ? lenis.limit : Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
    };
    subs.forEach((s) => s.read?.(f));
    subs.forEach((s) => s.write(f));
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); lenis?.destroy(); lenis = null; lastY = -1; };
}
