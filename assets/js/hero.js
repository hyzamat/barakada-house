// Hero film: the card rises, expands to full screen, then scrolling plays a cut of the kitchen.
// Frames are drawn on a canvas and blended, so scrolling feels like playback, not page movement.
import { FILM } from './film.js';
import { createFilmGL } from './fluid.js';
import { $, $$, el, mq, scroller } from './util.js';

const N = FILM.frames;
const EXPAND = 0.13; // share of the scroll spent opening the card
const END = 0.07; // share spent on the closing title
const IDLE = 12; // frames the card breathes through before anyone scrolls
const pad2 = (n) => String(n).padStart(2, '0');
const clock = (s) => `${pad2(Math.floor(s / 60))}:${pad2(Math.floor(s % 60))}`;

export const firstFrame = () => `media/film/${mq.portrait.matches ? 'p' : 'l'}-001.webp`;

export function initHero() {
  const sec = $('#top');
  const card = $('[data-film-card]', sec);
  const canvas = $('[data-film]', sec);
  let gl = null, ctx = null; // WebGL liquid renderer, or a plain 2D canvas if WebGL is unavailable
  const overlay = $('[data-film-overlay]', sec);
  const reduce = mq.reduce.matches;

  // ----- Frames -----
  let set = '', imgs = [], ready = [];
  const src = (i) => `media/film/${set}-${String(i + 1).padStart(3, '0')}.webp`;
  function load(i) {
    if (imgs[i]) return;
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { ready[i] = true; dirty = true; };
    im.src = src(i);
    imgs[i] = im;
  }
  function useSet() {
    const next = mq.portrait.matches ? 'p' : 'l';
    if (next === set) return;
    set = next; imgs = []; ready = [];
    for (let i = 0; i <= FILM.chapters[0].to; i++) load(i);
    for (const stride of [8, 4, 2, 1]) for (let i = 0; i < N; i += stride) load(i);
  }
  const nearest = (i) => {
    for (let d = 0; d < N; d++) {
      if (ready[i - d]) return i - d;
      if (ready[i + d]) return i + d;
    }
    return -1;
  };

  // ----- Drawing -----
  let cw = 0, ch = 0, dirty = true, shown = -1;
  function resize(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // Ignore the small height jumps from mobile URL bars.
    if (!force && w === cw && Math.abs(h - ch) < 140) return;
    cw = w;
    ch = h;
    dirty = true;
    if (gl) gl.resize(w, h);
    if (ctx) {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
  }
  function paint(img, alpha) {
    const W = canvas.width, H = canvas.height;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
  function render(f) {
    const a = Math.floor(f), b = Math.min(N - 1, a + 1), t = f - a;
    const base = nearest(a);
    if (base < 0) return;
    const blend = base === a && ready[b];
    if (gl) return gl.frames(imgs[base], blend ? imgs[b] : null, t);
    if (!ctx) return;
    const key = blend ? f : base;
    if (!dirty && Math.abs(key - shown) < 0.01) return;
    dirty = false;
    shown = key;
    paint(imgs[base], 1);
    if (base === a && ready[b] && t > 0.02) paint(imgs[b], t);
    ctx.globalAlpha = 1;
  }

  // ----- HUD & captions -----
  const bars = $('[data-film-bars]', sec);
  const caps = $('[data-film-caps]', sec);
  const hudN = $('[data-film-n]', sec), hudLabel = $('[data-film-label]', sec), hudTime = $('[data-film-time]', sec);
  const total = clock(N / FILM.fps);
  bars.innerHTML = FILM.chapters.map(() => '<div class="film__bar"><i></i></div>').join('');
  const fills = $$('.film__bar i', bars);
  const capEls = FILM.chapters.map((c, i) => {
    const words = c.line.split(' ').map((w, k) => `<span class="w" style="--i:${k + 1}">${w}</span>`).join(' ');
    const p = el('p', 'film__cap', `<small class="w" style="--i:0">${pad2(i + 1)} &mdash; ${c.label}</small>${words}`);
    caps.append(p);
    return p;
  });
  let chap = -1, sec0 = -1;
  function hud(f) {
    let ci = FILM.chapters.findIndex((c) => f <= c.to);
    if (ci < 0) ci = FILM.chapters.length - 1;
    if (ci !== chap) {
      capEls[chap]?.classList.replace('is-on', 'is-out');
      capEls[ci].classList.remove('is-out');
      capEls[ci].classList.add('is-on');
      fills.forEach((b, i) => { if (i !== ci) b.style.setProperty('--p', i < ci ? 1 : 0); });
      hudN.textContent = pad2(ci + 1);
      hudLabel.textContent = FILM.chapters[ci].label;
      chap = ci;
    }
    const c = FILM.chapters[ci];
    fills[ci].style.setProperty('--p', Math.min(1, Math.max(0, (f - c.from) / Math.max(1, c.to - c.from))));
    const s = Math.floor(f / FILM.fps);
    if (s !== sec0) { sec0 = s; hudTime.textContent = `${clock(s)} / ${total}`; }
  }

  // ----- Scroll mapping -----
  let progress = 0, target = 0, cur = 0, vel = 0, speed = 0;
  const frameAt = (p) => gsap.utils.clamp(0, 1, (p - EXPAND * 0.4) / (1 - EXPAND * 0.4 - END)) * (N - 1);

  useSet();
  addEventListener('resize', () => { resize(); useSet(); });
  createFilmGL(canvas, { maxDpr: mq.portrait.matches ? 1.25 : 1.5 })
    .then((g) => { gl = g; resize(true); })
    .catch(() => { ctx = canvas.getContext('2d', { alpha: false }); resize(true); });

  if (reduce) {
    const show = () => { render(Math.round(N * 0.9)); gl?.render(0, 0); };
    setInterval(show, 300);
    return { intro: () => gsap.timeline() };
  }

  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => { progress = self.progress; target = frameAt(progress); vel = self.getVelocity(); onScrolled(); },
  });
  // Keep the tray button out of the way (it shares the bottom with the scroll prompt) from the top of the page on.
  const zone = ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'bottom bottom',
    onToggle: (self) => document.documentElement.classList.toggle('in-film', self.isActive),
  });
  document.documentElement.classList.toggle('in-film', zone.isActive || scrollY < sec.offsetHeight - innerHeight);

  const mm = gsap.matchMedia();
  // Both conditions listed so the callback runs (and re-runs) for either orientation.
  mm.add({ portrait: '(max-aspect-ratio: 1/1)', landscape: '(min-aspect-ratio: 1/1)' }, (c) => {
    const s0 = c.conditions.portrait ? 0.88 : 0.72;
    const r0 = c.conditions.portrait ? 26 : 34;
    // The card starts just below the intro, whose height is --intro-h in the CSS.
    const introH = () => $('[data-film-intro]', sec).offsetHeight;
    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.35, invalidateOnRefresh: true },
    })
      .fromTo(card, { y: introH, scale: s0, rotateX: 16, borderRadius: r0 }, { y: 0, scale: 1, rotateX: 0, borderRadius: 0, duration: EXPAND, ease: 'power2.inOut' }, 0)
      // While only the top of the card peeks out, slide the picture up so its middle shows.
      .fromTo(canvas, { yPercent: -24 }, { yPercent: 0, duration: EXPAND, ease: 'power2.inOut' }, 0)
      .to('[data-film-intro]', { y: () => -innerHeight * 0.16, scale: 0.94, opacity: 0, duration: EXPAND * 0.8, ease: 'power1.in' }, 0)
      .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: EXPAND * 0.3 }, EXPAND * 0.75)
      .to(overlay, { autoAlpha: 0, duration: END * 0.4 }, 1 - END)
      .to('[data-film-veil]', { opacity: 1, duration: END * 0.5 }, 1 - END)
      .fromTo('[data-film-end]', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: END * 0.5, ease: 'power2.out' }, 1 - END * 0.8)
      .set({}, {}, 1);
  });

  // ----- Playback loop (only while visible) -----
  let raf = 0, visible = true, t0 = performance.now();
  function tick(now) {
    raf = requestAnimationFrame(tick);
    let goal = target;
    if (progress < 0.002) goal = (IDLE / 2) * (1 - Math.cos(((now - t0) / 1000) * (Math.PI * 2 / 3.2)));
    cur += (goal - cur) * (progress < 0.002 ? 1 : 0.3);
    if (Math.abs(goal - cur) < 0.002) cur = goal;
    render(cur);
    vel *= 0.9;
    speed += (Math.max(-1, Math.min(1, vel / 2600)) - speed) * 0.12;
    gl?.render(now / 1000, speed);
    if (progress > 0) hud(cur);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(tick);
  }).observe(sec);
  hud(0);

  // ----- Scroll prompt with play / pause -----
  const pop = $('[data-scrollpop]');
  const popTitle = $('[data-pop-title]', pop), popSub = $('[data-pop-sub]', pop);
  const popPlay = $('[data-pop-play]', pop), popIcon = $('[data-pop-icon]', pop);
  const firstTitle = popTitle.innerHTML;
  let idleTimer = 0, autoplay = false, introDone = false;

  const endY = () => sec.offsetTop + sec.offsetHeight - innerHeight;
  const filmSeconds = () => (N / FILM.fps) / (1 - EXPAND * 0.4 - END);
  function setPop(mode) {
    if (mode === 'start') { popTitle.innerHTML = firstTitle; popSub.textContent = 'or press play and sit back'; }
    if (mode === 'resume') { popTitle.textContent = 'Keep scrolling'; popSub.textContent = 'or press play to watch the rest'; }
    if (mode === 'playing') { popTitle.textContent = 'Now playing'; popSub.textContent = 'scroll anytime to take over'; }
    popIcon.innerHTML = `<use href="#i-${mode === 'playing' ? 'pause' : 'play'}"/>`;
    popPlay.setAttribute('aria-label', mode === 'playing' ? 'Pause the film' : 'Play the film');
  }
  const showPop = (mode) => { setPop(mode); pop.classList.add('is-on'); };
  const hidePop = () => pop.classList.remove('is-on');

  function onScrolled() {
    if (!introDone) return;
    clearTimeout(idleTimer);
    if (autoplay) return;
    if (progress > 0.004) hidePop();
    if (progress >= 1 - END) return;
    idleTimer = setTimeout(() => showPop(progress < 0.004 ? 'start' : 'resume'), progress < 0.004 ? 400 : 1800);
  }

  function play() {
    const lenis = scroller.lenis;
    const y = endY();
    const remaining = Math.max(0.5, (1 - progress) * filmSeconds());
    autoplay = true;
    showPop('playing');
    const done = () => { autoplay = false; hidePop(); };
    if (lenis) lenis.scrollTo(y, { duration: remaining, easing: (t) => t, onComplete: done });
    else { window.scrollTo({ top: y, behavior: 'smooth' }); setTimeout(done, 1500); }
  }
  function stop() {
    if (!autoplay) return;
    autoplay = false;
    scroller.lenis?.scrollTo(scrollY, { immediate: true });
    onScrolled();
  }
  popPlay.addEventListener('click', () => (autoplay ? stop() : play()));
  ['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, (e) => {
    if (autoplay && !pop.contains(e.target)) stop();
  }, { passive: true }));

  // Living type: letters swell toward the pointer, a slow wave keeps them breathing,
  // and a tap sends a ripple out from the touched letter.
  function livingTitle(chars) {
    const intro = $('[data-film-intro]', sec);
    const rgb = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    const states = chars.map((el) => {
      const gold = !!el.closest('em');
      const italic = getComputedStyle(el).fontStyle === 'italic';
      return {
        el, italic, p: 0, wv: 0, tap: 0, k: -1, w0: italic ? 280 : 360,
        from: gold ? [242, 205, 126] : [243, 234, 219], to: gold ? [255, 240, 200] : [255, 252, 245],
      };
    });
    gsap.timeline({ repeat: -1, repeatDelay: 2.6 })
      .to(states, { wv: 1, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1, stagger: 0.07 });
    if (mq.fine.matches) {
      intro.addEventListener('pointermove', (e) => {
        for (const s of states) {
          const r = s.el.getBoundingClientRect();
          const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          gsap.to(s, { p: Math.max(0, 1 - d / 280) ** 1.5, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
        }
      });
      intro.addEventListener('pointerleave', () => gsap.to(states, { p: 0, duration: 1, ease: 'power3.out', overwrite: 'auto' }));
    }
    $('.film__title', sec).addEventListener('pointerdown', (e) => {
      const from = Math.max(0, states.findIndex((s) => s.el === e.target.closest('.hchar')));
      gsap.timeline()
        .to(states, { tap: 1, duration: 0.3, ease: 'sine.out', stagger: { each: 0.05, from } })
        .to(states, { tap: 0, duration: 0.9, ease: 'sine.inOut', stagger: { each: 0.05, from } }, 0.3);
    });
    gsap.ticker.add(() => {
      if (progress > EXPAND) return;
      for (const s of states) {
        const k = Math.max(s.p, s.wv * 0.5, s.tap);
        if (Math.abs(k - s.k) < 0.004) continue;
        s.k = k;
        s.el.style.fontVariationSettings = `"wght" ${Math.round(s.w0 + 260 * k)}, "opsz" 144, "SOFT" ${s.italic ? 100 : Math.round(40 + 60 * k)}, "WONK" ${s.italic ? 1 : 0}`;
        s.el.style.color = rgb(s.from, s.to, k);
        s.el.style.transform = `translateY(${(-7 * k).toFixed(2)}%)`;
      }
    });
  }

  // The badge cycles through a few short lines.
  function ticker() {
    const lines = $$('[data-ticker] > span', sec);
    let i = 0;
    gsap.set(lines.slice(1), { yPercent: 100, opacity: 0 });
    setInterval(() => {
      if (progress > EXPAND) return;
      const cur = lines[i];
      i = (i + 1) % lines.length;
      gsap.to(cur, { yPercent: -100, opacity: 0, duration: 0.6, ease: 'power3.in' });
      gsap.fromTo(lines[i], { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out', delay: 0.35 });
    }, 3200);
  }

  // Loader hands over to this intro.
  function intro() {
    const split = SplitText.create($$('.film__w', sec), { type: 'chars', charsClass: 'hchar' });
    const lede = $('.film__lede', sec);
    const words = SplitText.create(lede, { type: 'words' });
    const tl = gsap.timeline({ onComplete: () => { introDone = true; onScrolled(); livingTitle(split.chars); ticker(); } });
    // The nav's CSS transition (for hiding on scroll) would fight this tween and leave the nav stuck
    // off-screen, so it's off until the nav lands; clearing the inline styles hands it back to CSS.
    gsap.set('.nav', { transition: 'none' });
    tl.from(split.chars, { yPercent: 115, rotate: 5, duration: 1.3, ease: 'expo.out', stagger: 0.04 }, 0.05)
      .from('.film__badge', { y: 16, opacity: 0, scale: 0.9, duration: 1, ease: 'expo.out' }, 0)
      .from(words.words, { y: 14, opacity: 0, filter: 'blur(8px)', duration: 1, ease: 'expo.out', stagger: 0.025 }, 0.4)
      .add(() => lede.classList.add('is-in'), 0.9)
      .fromTo('.film__btns > *', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.6)
      .from('.film__stage', { yPercent: 40, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0.2)
      .from('.nav', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', clearProps: 'all' }, 0.5);
    return tl;
  }

  return { intro };
}
