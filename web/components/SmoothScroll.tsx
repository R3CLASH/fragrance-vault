'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { scrollToY, startScroll } from '@/lib/scroll';

/** Starts Lenis and the shared animation loop, and lands every new page at the top. */
export default function SmoothScroll() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => startScroll(), []);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!window.location.hash) scrollToY(0, true);
  }, [path]);
  return null;
}
