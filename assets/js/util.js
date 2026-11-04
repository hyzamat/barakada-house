// Shared helpers: DOM, media paths, video autoplay, scroll lock, haptics.

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const mq = {
  portrait: matchMedia('(max-aspect-ratio: 1/1)'),
  fine: matchMedia('(hover: hover) and (pointer: fine)'),
  reduce: matchMedia('(prefers-reduced-motion: reduce)'),
};
export const saveData = navigator.connection?.saveData === true;

const orient = () => (mq.portrait.matches ? 'p' : 'l');
export const clipSrc = (id, o = orient()) => `media/v/${id}-${o}.mp4`;
export const posterSrc = (id, o = orient()) => `media/p/${id}-${o}.webp`;
export const plateSrc = (id) => `media/p/${id}-s.webp`;

export const money = (n) => 'SAR ' + Math.round(n).toLocaleString('en-US');
export const pad = (n) => String(n).padStart(2, '0');

export function haptic(ms = 8) {
  if (!navigator.userActivation?.hasBeenActive) return;
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}

export function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
}

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

export const icon = (name, cls = '') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

export function personIcons(n, max = 24) {
  const shown = Math.min(n, max);
  let html = '';
  for (let i = 0; i < shown; i++) html += icon('person', 'person');
  if (n > max) html += `<span class="person person--more">+${n - max}</span>`;
  return html;
}

// ----- Video -----
export function prepVideo(v, id, { o } = {}) {
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('muted', '');
  if (id) v.dataset.clip = id;
  if (o) v.dataset.o = o;
  return v;
}

export function ensureSrc(v) {
  const id = v.dataset.clip;
  if (!id) return;
  const src = clipSrc(id, v.dataset.o);
  if (v.dataset.src !== src) {
    v.dataset.src = src;
    v.src = src;
  }
}

export function play(v) {
  if (saveData) return;
  ensureSrc(v);
  const p = v.play();
  if (p) p.then(() => v.classList.add('is-playing')).catch(() => {});
}

export function pause(v) {
  if (!v.paused) v.pause();
}

// Plays videos while they are in view; pauses them when they leave.
const watched = new Map();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const opts = watched.get(e.target);
    if (!opts) continue;
    if (e.isIntersecting) play(e.target);
    else pause(e.target);
  }
}, { rootMargin: '0px', threshold: 0.15 });

const bandIO = new IntersectionObserver((entries) => {
  for (const e of entries) e.isIntersecting ? play(e.target) : pause(e.target);
}, { rootMargin: '-28% 0px -28% 0px', threshold: 0 });

export function autoplay(v, { band = false } = {}) {
  prepVideo(v);
  watched.set(v, { band });
  (band ? bandIO : io).observe(v);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.querySelectorAll('video').forEach((v) => v.pause());
});

// ----- Scroll lock shared with Lenis -----
let lenis = null;
let locks = 0;
export const scroller = {
  set(l) { lenis = l; },
  get lenis() { return lenis; },
  lock() {
    if (locks++ === 0) {
      lenis?.stop();
      document.documentElement.classList.add('is-locked');
    }
  },
  unlock() {
    if (locks > 0 && --locks === 0) {
      lenis?.start();
      document.documentElement.classList.remove('is-locked');
    }
  },
  to(target, opts = {}) {
    const node = typeof target === 'string' ? document.querySelector(target) : target;
    if (!node) return;
    if (lenis) lenis.scrollTo(node, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    else node.scrollIntoView({ behavior: mq.reduce.matches ? 'auto' : 'smooth' });
  },
};

// ----- Toast -----
let toastTimer;
export function toast(msg) {
  const t = document.querySelector('[data-toast]');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
}

// Drag-down-to-dismiss for bottom sheets (touch only, panel at scrollTop 0).
export function dragToClose(panel, handle, onClose) {
  let y0 = 0, dy = 0, t0 = 0, down = false, dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || panel.scrollTop > 2 || e.target.closest('button')) return;
    down = true; dragging = false; y0 = e.clientY; dy = 0; t0 = performance.now();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!down) return;
    dy = Math.max(0, e.clientY - y0);
    if (!dragging && dy > 6) {
      dragging = true;
      try { handle.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    }
    if (dragging) gsap.set(panel, { y: dy });
  });
  const end = () => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > 120 || (v > 0.5 && dy > 30)) onClose();
    else gsap.to(panel, { y: 0, duration: 0.5, ease: 'expo.out' });
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
