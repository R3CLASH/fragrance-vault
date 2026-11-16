'use client';

import { useEffect, useRef } from 'react';
import { particleCloud } from '@/lib/engines';
import { onFrame } from '@/lib/scroll';

/** The vault wheel on the shop page: a filtered view morphs it into a bottle. */
export default function ShopWheel({ filtered, tint }: { filtered: boolean; tint: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cloud = useRef<ReturnType<typeof particleCloud> | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = particleCloud(ref.current, 'dust', window.innerWidth < 700 ? 800 : 1300);
    cloud.current = c;
    const off = onFrame((f) => { if (f.dy) c.ry += f.dy * 0.006; });
    return () => { off(); c.stop(); };
  }, []);
  useEffect(() => {
    const c = cloud.current; if (!c) return;
    c.C[1] = tint; c.rx = filtered ? -0.14 : -0.3; c.to(filtered ? 'bottle' : 'wheel');
  }, [filtered, tint]);
  return <canvas ref={ref} aria-hidden="true" />;
}
