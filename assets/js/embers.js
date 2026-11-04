// Rising charcoal embers on a canvas. Pointer or touch stirs them up and leaves a trail of sparks.
import { mq } from './util.js';

function sprite(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, '#fff8e0');
  grd.addColorStop(0.18, inner);
  grd.addColorStop(0.45, outer);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function initEmbers(canvas, section) {
  if (!canvas || mq.reduce.matches) return;
  const ctx = canvas.getContext('2d');
  const sprites = [
    sprite('rgba(255,214,120,1)', 'rgba(255,140,40,.35)'),
    sprite('rgba(255,160,60,1)', 'rgba(230,80,20,.35)'),
    sprite('rgba(255,110,40,1)', 'rgba(190,40,10,.3)'),
  ];
  const glow = sprite('rgba(255,150,60,.5)', 'rgba(228,91,44,.12)');
  const parts = [];
  const pointer = { x: 0, y: 0, vx: 0, vy: 0, on: false, t: 0 };
  let w = 0, h = 0, dpr = 1, raf = 0, running = false, last = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const cap = () => Math.round(Math.min(200, (w * h) / 6500));

  function spawn(x, y, burst) {
    parts.push({
      x, y,
      vx: (Math.random() - 0.5) * (burst ? 4 : 0.5),
      vy: -(Math.random() * 1.3 + 0.4) * (burst ? 2.2 : 1),
      life: 0,
      max: (burst ? 50 : 140) + Math.random() * (burst ? 70 : 200),
      r: Math.random() * (burst ? 2.4 : 2) + 0.7,
      s: (Math.random() * 3) | 0,
      ph: Math.random() * 6.28,
    });
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(2.5, (t - last) / 16.67 || 1);
    last = t;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    const n = cap();
    for (let k = 0; parts.length < n && k < 4; k++) spawn(Math.random() * w, h * (0.75 + Math.random() * 0.3), false);

    if (pointer.on) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(glow, pointer.x - 130, pointer.y - 130, 260, 260);
      if (t - pointer.t > 1200) pointer.on = false;
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      p.vx += Math.sin(p.y * 0.012 + t * 0.0012 + p.ph) * 0.035 * dt;
      if (pointer.on) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 150) {
          const f = (1 - d / 150) * 0.8 * dt;
          p.vx += (dx / (d + 0.1)) * f + pointer.vx * 0.015;
          p.vy += (dy / (d + 0.1)) * f + pointer.vy * 0.015;
        }
      }
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 - 0.014 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.life / p.max;
      if (k >= 1 || p.y < -30 || p.x < -30 || p.x > w + 30) { parts.splice(i, 1); continue; }
      const a = (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88) * (0.65 + 0.35 * Math.sin(t * 0.012 + p.ph * 4));
      const size = p.r * 7 * (1.2 - k * 0.5);
      ctx.globalAlpha = Math.max(0, a);
      ctx.drawImage(sprites[p.s], p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  const start = () => { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  function stir(x, y) {
    const r = canvas.getBoundingClientRect();
    const nx = x - r.left, ny = y - r.top;
    pointer.vx = nx - pointer.x;
    pointer.vy = ny - pointer.y;
    pointer.x = nx;
    pointer.y = ny;
    pointer.on = true;
    pointer.t = performance.now();
    for (let i = 0; i < 3; i++) spawn(nx + (Math.random() - 0.5) * 20, ny + (Math.random() - 0.5) * 20, true);
  }
  section.addEventListener('pointermove', (e) => stir(e.clientX, e.clientY), { passive: true });
  section.addEventListener('pointerdown', (e) => {
    for (let i = 0; i < 18; i++) stir(e.clientX, e.clientY);
  }, { passive: true });
  section.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) stir(t.clientX, t.clientY); }, { passive: true });

  resize();
  addEventListener('resize', resize);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '100px' }).observe(section);
}
