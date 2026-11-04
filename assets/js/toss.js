// Scroll to toss: scrolling scrubs a wok toss; the pointer ripples the picture like heat haze.
import { TOSS } from './toss-data.js';
import { byId } from './data.js';
import { createFilmGL } from './fluid.js';
import { $, $$, mq, money } from './util.js';

export function initToss({ addToTray }) {
  const sec = $('#toss');
  const canvas = $('[data-toss]', sec);
  const steps = $$('[data-toss-steps] li', sec);
  const pct = $('[data-toss-pct]', sec), bar = $('[data-toss-bar]', sec), glow = $('[data-toss-glow]', sec);
  const N = TOSS.frames;
  let imgs = [], ready = [], set = mq.portrait.matches ? 'p' : 'l';
  const src = (i) => `media/seq/${set}-${String(i + 1).padStart(3, '0')}.webp`;
  let gl = null, ctx = null, started = false;

  $('[data-toss-price]', sec).textContent = money(byId.chopsuey.price);
  $('[data-toss-add]', sec).addEventListener('click', (e) => addToTray('chopsuey', e.currentTarget));

  function load(i) {
    if (imgs[i]) return;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { ready[i] = true; };
    im.src = src(i);
    imgs[i] = im;
  }
  function loadAll() {
    if (started) return;
    started = true;
    for (const stride of [12, 6, 3, 1]) for (let i = 0; i < N; i += stride) load(i);
  }
  const nearest = (i) => {
    for (let d = 0; d < N; d++) {
      if (ready[i - d]) return i - d;
      if (ready[i + d]) return i + d;
    }
    return -1;
  };

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (gl) gl.resize(w, h);
    if (ctx) {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
  }
  function draw(f) {
    const a = Math.floor(f), b = Math.min(N - 1, a + 1), t = f - a;
    const base = nearest(a);
    if (base < 0) return;
    const next = base === a && ready[b] ? imgs[b] : null;
    if (gl) return gl.frames(imgs[base], next, t);
    if (!ctx) return;
    const paint = (img, alpha) => {
      const W = canvas.width, H = canvas.height;
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    };
    paint(imgs[base], 1);
    if (next && t > 0.02) paint(next, t);
    ctx.globalAlpha = 1;
  }

  new IntersectionObserver(([e]) => { if (e.isIntersecting) loadAll(); }, { rootMargin: '150% 0px' }).observe(sec);
  addEventListener('resize', () => {
    size();
    const next = mq.portrait.matches ? 'p' : 'l';
    if (next !== set && started) { set = next; imgs = []; ready = []; started = false; loadAll(); }
  });
  createFilmGL(canvas, { maxDpr: 1.5 })
    .then((g) => { gl = g; size(); })
    .catch(() => { ctx = canvas.getContext('2d'); size(); });

  // One title at a time: the old one leaves before the next arrives.
  let step = 0;
  const setStep = (i) => {
    if (i === step) return;
    steps[step].classList.remove('is-on');
    steps[i].classList.add('is-on');
    step = i;
  };

  let target = 0, cur = 0, vel = 0, speed = 0, progress = 0;
  if (mq.reduce.matches) {
    target = cur = N * 0.35;
  } else {
    ScrollTrigger.create({
      trigger: sec, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => {
        progress = self.progress;
        target = progress * (N - 1);
        vel = self.getVelocity();
        setStep(progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2);
        pct.textContent = String(Math.round(progress * 100)).padStart(2, '0');
        bar.style.transform = `scaleX(${progress})`;
      },
      // Tuck the tray button away so it doesn't cover the meter.
      onToggle: (self) => document.documentElement.classList.toggle('in-film', self.isActive),
    });
    // The framed window opens to full screen as the section arrives.
    gsap.fromTo('[data-toss-media]', { clipPath: 'inset(7% 5% 7% 5% round 32px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top top', scrub: 0.5 },
    });
    gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.5 } })
      .fromTo(canvas, { scale: 1.12 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .fromTo(glow, { opacity: 0.2 }, { opacity: 1, ease: 'sine.inOut', duration: 0.35, yoyo: true, repeat: 1 }, 0.1);
  }

  let raf = 0;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    cur += (target - cur) * 0.3;
    vel *= 0.9;
    speed += (Math.max(-1, Math.min(1, vel / 2600)) - speed) * 0.12;
    draw(cur);
    gl?.render(now / 1000, speed);
  };
  new IntersectionObserver(([e]) => {
    cancelAnimationFrame(raf);
    if (e.isIntersecting) raf = requestAnimationFrame(tick);
  }).observe(sec);
}
