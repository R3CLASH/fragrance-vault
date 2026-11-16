'use client';

import { useEffect, useRef, useState } from 'react';
import type { Media } from '@/lib/strapi';
import { particleCloud } from '@/lib/engines';

/** Product gallery: the bottle floats in a ring of particles; drag to tilt it. Notes recolour the ring. */
export default function ProductStage({ images, name, accent, noteTint }: { images: Media[]; name: string; accent: string | null; noteTint: string | null }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const cloud = useRef<ReturnType<typeof particleCloud> | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!cv.current) return;
    const c = particleCloud(cv.current, 'halo', window.innerWidth < 700 ? 1200 : 2000);
    c.C = ['#D4AF37', accent || '#F6E27A', '#FFF6D6']; c.rx = -0.38; c.k = c.kt = 1.1;
    cloud.current = c;
    const burst = () => c.burst();
    window.addEventListener('fv:added', burst);
    return () => { c.stop(); window.removeEventListener('fv:added', burst); };
  }, [accent]);
  useEffect(() => { if (cloud.current && noteTint) { cloud.current.C[1] = noteTint; cloud.current.ry += 1.2; } }, [noteTint]);

  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, tx: 0, ty: 0 }; if (cloud.current) cloud.current.vy = 0; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !img.current) return;
    d.ty = Math.max(-40, Math.min(40, d.ty + (e.clientX - d.x) * 0.4)); d.tx = Math.max(-18, Math.min(18, d.tx - (e.clientY - d.y) * 0.25));
    if (cloud.current) cloud.current.ry += (e.clientX - d.x) * 0.012;
    d.x = e.clientX; d.y = e.clientY;
    img.current.style.transition = 'none'; img.current.style.transform = `rotateY(${d.ty}deg) rotateX(${d.tx}deg)`;
  };
  const up = () => { drag.current = null; if (img.current) { img.current.style.transition = ''; img.current.style.transform = ''; } if (cloud.current) cloud.current.vy = 0.008; };

  const main = images[idx];
  return (
    <div className="gallery">
      <div className="stage">
        <div className="stage-ring" aria-hidden="true" />
        <canvas ref={cv} className="fill" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true" />
        <div className="stage-img">
          {main ? <img ref={img} src={main.url} alt={main.alt || name} width={main.width} height={main.height} /> : <span className="ph" style={{ width: 150, height: 240, display: 'block', borderRadius: 18, border: '1px solid rgba(246,226,122,.6)', background: 'linear-gradient(180deg,rgba(255,255,255,.05) 26%,#8a5a12 26%,#3b2204)' }} />}
        </div>
        <span className="stage-tag" style={{ left: 18 }}>THE VAULT</span>
        <span className="stage-tag" style={{ right: 18, color: accent || 'var(--gold)' }}>DRAG</span>
      </div>
      {images.length > 1 ? (
        <div className="thumbs">
          {images.map((m, i) => (
            <button key={m.url} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} aria-label={`Show image ${i + 1}`}><img src={m.url} alt="" /></button>
          ))}
        </div>
      ) : null}
      <p className="hint">Drag the bottle to tilt it and spin the ring</p>
    </div>
  );
}
