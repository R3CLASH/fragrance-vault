// Canvas engines for the vault animations. Plain 2D canvas, no libraries.
/* eslint-disable @typescript-eslint/no-explicit-any */

const R = Math.random;

function bottlePt(): number[] {
  const t = R(), a = R() * 6.283;
  let y: number, r: number, k = 0;
  if (t < 0.1) { y = 0.74 + R() * 0.26; r = 0.2; k = 2; }
  else if (t < 0.14) { y = 1; r = 0.2 * Math.sqrt(R()); k = 2; }
  else if (t < 0.2) { y = 0.6 + R() * 0.14; r = 0.1; }
  else if (t < 0.3) { const u = R(); y = 0.48 + u * 0.12; r = 0.52 - u * 0.42; }
  else if (t < 0.62) { y = -0.9 + R() * 1.38; r = 0.52; }
  else if (t < 0.7) { y = -0.9; r = 0.52 * Math.sqrt(R()); }
  else { y = -0.86 + R() * 0.95; r = 0.46 * Math.sqrt(R()); k = 1; }
  const body = t >= 0.2;
  const q = body ? r / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 0.25) : r;
  return [q * Math.cos(a), y, q * Math.sin(a) * (body ? 0.6 : 1), k];
}

const SHAPES: Record<string, () => number[]> = {
  dust: () => { const a = R() * 6.283, b = Math.acos(2 * R() - 1), r = 0.7 + R() * 0.7; return [r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a), 0]; },
  wheel: () => {
    const t = R(), a = R() * 6.283;
    if (t < 0.5) { const b = R() * 6.283, r = 0.92 + 0.07 * Math.cos(b); return [r * Math.cos(a), r * Math.sin(a), 0.07 * Math.sin(b), 0]; }
    if (t < 0.62) { const r = 0.22 * Math.sqrt(R()); return [r * Math.cos(a), r * Math.sin(a), (R() - 0.5) * 0.14, 2]; }
    const k = Math.floor(R() * 8) * 0.7854, r = 0.22 + R() * 0.98;
    return [r * Math.cos(k) + (R() - 0.5) * 0.04, r * Math.sin(k) + (R() - 0.5) * 0.04, (R() - 0.5) * 0.05, 0];
  },
  halo: () => {
    const t = R(), a = R() * 6.283;
    if (t < 0.7) { const b = R() * 6.283, r = 1 + 0.05 * Math.cos(b) + (R() - 0.5) * 0.14; return [r * Math.cos(a), 0.05 * Math.sin(b) - 0.15, r * Math.sin(a), t < 0.3 ? 0 : 1]; }
    const b2 = Math.acos(2 * R() - 1), r2 = 0.6 + R() * 0.9;
    return [r2 * Math.sin(b2) * Math.cos(a), r2 * Math.cos(b2), r2 * Math.sin(b2) * Math.sin(a), 2];
  },
  bottle: bottlePt,
};

/** Tracks a canvas's size and whether it is on screen, without measuring it every frame. */
function view(cv: HTMLCanvasElement) {
  const v = { w: cv.clientWidth, h: cv.clientHeight, vis: true, stop: () => {} };
  const ro = new ResizeObserver(([e]) => { v.w = e.contentRect.width; v.h = e.contentRect.height; });
  const io = new IntersectionObserver(([e]) => { v.vis = e.isIntersecting; });
  ro.observe(cv); io.observe(cv);
  v.stop = () => { ro.disconnect(); io.disconnect(); };
  return v;
}

function fit(cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D, v: ReturnType<typeof view>): [number, number] | null {
  const w = v.w, h = v.h, d = Math.min(window.devicePixelRatio || 1, 2);
  if (!w || !h || !v.vis) return null;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
  return [w, h];
}

export type Cloud = { ry: number; vy: number; rx: number; k: number; kt: number; on: boolean; C: string[]; to: (shape: string) => void; burst: () => void; stop: () => void };

/** A rotating 3D particle cloud that can morph between shapes: dust, wheel, bottle, halo. */
export function particleCloud(cv: HTMLCanvasElement, first: string, n: number): Cloud {
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const P: number[][] = [];
  const S: any = { ry: 0, vy: 0.007, rx: -0.2, k: 1, kt: 1, on: true, C: ['#D4AF37', '#FF9E3D', '#FFF1A8'] }, V = view(cv);
  for (let i = 0; i < n; i++) { const d = SHAPES.dust(), q = (SHAPES[first] || SHAPES.dust)(); P.push([d[0], d[1], d[2], q[0], q[1], q[2], q[3], 1 + R() * 1.6, R() * 6.283]); }
  S.to = (name: string) => { const f = SHAPES[name] || SHAPES.dust; for (const p of P) { const q = f(); p[3] = q[0]; p[4] = q[1]; p[5] = q[2]; p[6] = q[3]; } };
  S.burst = () => { for (const p of P) { const d = SHAPES.dust(); p[0] = d[0] * 1.6; p[1] = d[1] * 1.6; p[2] = d[2] * 1.6; } };
  S.stop = () => { S.on = false; };
  let T = 0;
  const frame = () => {
    if (!S.on || !cv.isConnected) { S.on = false; V.stop(); return; }
    const wh = fit(cv, ctx, V);
    if (wh) {
      const w = wh[0], h = wh[1];
      T += 0.03; S.ry += S.vy; S.k += (S.kt - S.k) * 0.08;
      const cy = Math.cos(S.ry), sy = Math.sin(S.ry), cx = Math.cos(S.rx), sx = Math.sin(S.rx), sc = Math.min(w, h) * 0.38 * S.k;
      for (const p of P) {
        p[0] += (p[3] - p[0]) * 0.05; p[1] += (p[4] - p[1]) * 0.05; p[2] += (p[5] - p[2]) * 0.05;
        const x = p[0] * cy + p[2] * sy, z0 = p[2] * cy - p[0] * sy, y = p[1] * cx - z0 * sx, z = p[1] * sx + z0 * cx, f = 3 / (3 + z);
        ctx.globalAlpha = Math.max(0.12, Math.min(1, 0.7 - z * 0.5)) * (0.65 + 0.35 * Math.sin(T + p[8]));
        ctx.fillStyle = S.C[p[6]];
        const r = p[7] * f; ctx.fillRect(w / 2 + x * sc * f, h / 2 - y * sc * f, r, r);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return S as Cloud;
}

export type Tunnel = { p: number; mx: number; my: number; tt: number; on: boolean; stop: () => void };

/**
 * The homepage hero: a tunnel of rotating vault rings. `p` (0..1) is the camera position.
 * At the end, particles assemble into the featured bottle (sampled from its photo), then the photo fades in.
 */
export function vaultTunnel(cv: HTMLCanvasElement, n: number, getImage: () => HTMLImageElement | null): Tunnel {
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const END = 24, rings: number[][] = [], dust: number[][] = [], B: any[][] = [];
  const S: any = { p: 0, c: 0, mx: 0, my: 0, sx: 0, sy: 0, t: 0, tt: 0, on: true, img: null, asp: 0.57, sampled: false }, V = view(cv);
  const C = ['#D4AF37', '#FF9E3D', '#FFF1A8'];
  for (let i = 0; i < 24; i++) rings.push([1.4 + i, i % 3, i % 2 ? 1 : -1, R() * 6.283]);
  for (let i = 0; i < 420; i++) dust.push([R() * 6.283, 0.75 + R() * 0.7, R() * 14, 0.6 + R() * 1.4]);
  for (let i = 0; i < n; i++) {
    const q = bottlePt(), a = R() * 6.283, b = Math.acos(2 * R() - 1), r = 1 + R() * 2.5;
    B.push([q[0], q[1], q[2], q[3], r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a), 1 + R() * 1.6, R() * 6.283, C[q[3]]]);
  }
  S.stop = () => { S.on = false; };
  const sample = () => {
    const im = getImage();
    if (!im) { return; }
    if (!im.complete) return;
    S.sampled = true;
    if (!im.naturalWidth) return;
    try {
      const asp = im.naturalWidth / im.naturalHeight, Hh = 112, W = Math.max(8, Math.round(Hh * asp));
      const oc = document.createElement('canvas'); oc.width = W; oc.height = Hh;
      const ox = oc.getContext('2d') as CanvasRenderingContext2D; ox.drawImage(im, 0, 0, W, Hh);
      const d = ox.getImageData(0, 0, W, Hh).data, ok: number[] = [];
      for (let i = 0; i < W * Hh; i++) if (d[i * 4 + 3] > 90) ok.push(i);
      // A photo without a transparent background would fill the whole rectangle: keep the generic bottle instead.
      if (!ok.length || ok.length > W * Hh * 0.97) return;
      for (const p of B) {
        const i = ok[Math.floor(R() * ok.length)], px = i % W, py = Math.floor(i / W);
        p[0] = ((px + R()) / W - 0.5) * 2 * asp; p[1] = (0.5 - (py + R()) / Hh) * 2; p[2] = (R() - 0.5) * 0.12;
        p[9] = 'rgb(' + d[i * 4] + ',' + d[i * 4 + 1] + ',' + d[i * 4 + 2] + ')';
      }
      S.img = im; S.asp = asp;
    } catch { S.img = null; }
  };
  const frame = () => {
    if (!S.on || !cv.isConnected) { S.on = false; V.stop(); return; }
    const wh = fit(cv, ctx, V);
    if (wh) {
      const w = wh[0], h = wh[1];
      if (!S.sampled) sample();
      S.t += 0.008; S.c += (S.p - S.c) * 0.09; S.sx += (S.mx - S.sx) * 0.06; S.sy += (S.my - S.sy) * 0.06;
      const e = S.c * S.c * (3 - 2 * S.c), cam = e * END, F = Math.hypot(w, h) * 0.5, vx = w / 2, vy = h / 2;
      const zb = END + 2.6 - cam, kb = 1 - Math.min(1, 1 / zb), bx = vx + S.sx * 110 * kb;
      const top0 = w < 900 ? 70 : 92, avail = Math.max(120, (S.tt || h * 0.62) - 22 - top0), scF = Math.min(w * 0.5, h * 0.24, avail / 2);
      const by = vy + S.sy * 70 * kb + (top0 + avail / 2 - vy) * e;
      const sc = scF * (2.6 / zb), gr = sc * 2.4 + 50;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, gr);
      g.addColorStop(0, S.img ? 'rgba(110,185,255,0.3)' : 'rgba(212,175,55,0.26)'); g.addColorStop(1, 'rgba(110,185,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(bx - gr, by - gr, gr * 2, gr * 2);
      for (const r of rings) {
        const z = r[0] - cam; if (z < 0.1 || z > 13) continue;
        const f = 1 / z, k = 1 - Math.min(1, f), rad = F * 0.95 * f, a = r[3] + r[2] * (S.t * 0.7 + cam * 0.35);
        ctx.globalAlpha = Math.min(1, (13 - z) / 5) * Math.min(1, z / 0.5) * (r[1] === 1 ? 0.9 : 0.6);
        ctx.strokeStyle = z < 2.5 ? '#F6E27A' : '#D4AF37';
        ctx.lineWidth = r[1] === 1 ? Math.max(1.5, rad * 0.035) : Math.max(0.7, r[1] === 2 ? rad * 0.012 : rad * 0.004);
        ctx.setLineDash(r[1] === 1 ? [rad * 0.012, rad * 0.075] : r[1] === 2 ? [rad * 0.62, rad * 0.2] : []);
        ctx.beginPath(); ctx.arc(vx + S.sx * 110 * k, vy + S.sy * 70 * k, rad, a, a + 6.2832); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.fillStyle = '#F6E27A';
      for (const p of dust) {
        const z = (((p[2] - cam) % 14) + 14) % 14 + 0.15, f = 1 / z, k = 1 - Math.min(1, f), rad = F * p[1] * f, s = Math.min(3.5, p[3] * f * 1.6 + 0.4);
        ctx.globalAlpha = Math.min(1, (14 - z) / 6) * 0.8;
        ctx.fillRect(vx + S.sx * 110 * k + Math.cos(p[0]) * rad, vy + S.sy * 70 * k + Math.sin(p[0]) * rad, s, s);
      }
      const sp0 = 1 - Math.min(1, Math.max(0, (S.c - 0.45) / 0.5)), sp = sp0 * sp0 * 3;
      const arr = Math.min(1, Math.max(0, (S.c - 0.8) / 0.15)), fade = S.img ? Math.min(1, Math.max(0, (S.c - 0.88) / 0.1)) : 0, pa = S.img ? 0.7 - 0.5 * fade : 1;
      const ry = S.img ? Math.sin(S.t * 2.2) * 0.55 * (1 - arr) : S.t * 1.2 + cam * 0.2, tl = S.img ? 0 : -0.14;
      const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(tl), sx = Math.sin(tl), ps = Math.max(0.5, Math.min(1, sc / 120));
      for (const p of B) {
        const X = p[0] + p[4] * sp, Y = p[1] + p[5] * sp, Z = p[2] + p[6] * sp;
        const x = X * cy + Z * sy, z0 = Z * cy - X * sy, y = Y * cx - z0 * sx, z = Y * sx + z0 * cx, f = 3 / (3 + z);
        ctx.globalAlpha = Math.max(0.12, Math.min(1, 0.7 - z * 0.5)) * (0.65 + 0.35 * Math.sin(S.t * 4 + p[8])) * pa;
        ctx.fillStyle = p[9];
        const r = p[7] * f * ps; ctx.fillRect(bx + x * sc * f, by - y * sc * f, r, r);
      }
      if (S.img && fade > 0) {
        const ih = sc * 2, iw = ih * S.asp;
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade;
        ctx.drawImage(S.img, bx - iw / 2, by - ih / 2 + Math.sin(S.t * 3) * 4, iw, ih);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return S as Tunnel;
}
