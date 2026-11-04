import { DISHES, INFO, clipOf } from './data.js';
import { $, $$, el, mq, plateSrc, prepVideo, play, pause, autoplay, scroller } from './util.js';
import { initHero, firstFrame } from './hero.js';
import { initIngredients } from './ingredients.js';
import { initTour } from './tour.js';
import { initSusan } from './susan.js';
import { initEmbers } from './embers.js';
import { initToss } from './toss.js';
import { initMenu } from './menu.js';
import { initStory } from './story.js';
import { initTray } from './tray.js';
import { initReserve } from './reserve.js';
import { initQr } from './qr.js';

const reduce = mq.reduce.matches;

if (!window.gsap) {
  // Libraries failed to load (offline): show the page without motion.
  $('.loader')?.remove();
  document.documentElement.classList.add('no-motion');
} else {
  boot();
}

function boot() {
  gsap.registerPlugin(ScrollTrigger, SplitText, Flip);
  document.documentElement.classList.add('js');
  history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  if (!reduce && window.Lenis) {
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    scroller.set(lenis);
  }
  scroller.lock();

  fillInfo();
  buildMarquees();

  // Modules talk to each other through these handles.
  const api = {};
  api.tray = initTray({ openDish: (id) => api.menu.openDish(id) });
  api.story = initStory({ addToTray: api.tray.add });
  api.menu = initMenu({ openStory: api.story.open, addToTray: api.tray.add });
  initSusan({ openStory: api.story.open, openDish: api.menu.openDish, addToTray: api.tray.add });
  initReserve();
  initQr();
  initTour({ story: api.story, menu: api.menu });
  api.tray.refresh();
  initEmbers($('[data-embers]'), $('#fire'));
  initToss({ addToTray: api.tray.add });
  autoplay($('.fire__bg'));

  const hero = initHero();
  initIngredients($('#ingredients'));
  reveals();
  marquees();
  nav();
  cursor();
  magnetic();
  footer();
  polish();

  runLoader(hero);
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
}

/* ---------------- Loader ---------------- */
async function runLoader(hero) {
  const loader = $('.loader');
  const num = $('.loader__num', loader);
  const counter = { v: 0 };
  const set = () => { num.textContent = String(Math.round(counter.v)).padStart(2, '0'); };
  const first = new Image();
  first.src = firstFrame();

  gsap.from('.loader__word', { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out' });
  gsap.from('.loader__hint', { opacity: 0, duration: 1, delay: 0.3 });
  const climb = gsap.to(counter, { v: 92, duration: reduce ? 0.2 : 1.8, ease: 'power2.out', onUpdate: set });

  const ready = Promise.all([
    document.fonts?.ready,
    first.decode().catch(() => {}),
    new Promise((r) => setTimeout(r, reduce ? 150 : 1400)),
  ]);
  await Promise.race([ready, new Promise((r) => setTimeout(r, 3200))]);
  climb.kill();
  await gsap.to(counter, { v: 100, duration: 0.35, ease: 'power1.out', onUpdate: set });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    loader.remove();
    scroller.unlock();
    ScrollTrigger.refresh();
  };
  // Safety net in case animation frames are paused (e.g. page opened in a background tab).
  setTimeout(finish, 4000);
  const tl = gsap.timeline({ onComplete: finish });
  tl.to('.loader__inner', { yPercent: -20, opacity: 0, duration: 0.6, ease: 'power3.in' })
    .to(num, { opacity: 0, duration: 0.3 }, 0)
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, 0.35)
    .add(hero.intro(), 0.75);
}

/* ---------------- Text reveals ---------------- */
function reveals() {
  if (reduce) return;
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }),
  });

  $$('[data-split]').forEach((h) => {
    SplitText.create(h, {
      type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, {
        yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: h, start: 'top 86%', once: true },
      }),
    });
  });

  const orbTitle = $('[data-veg-title]');
  gsap.from(orbTitle.children, {
    yPercent: 60, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: orbTitle.parentElement, start: 'top 70%', once: true },
  });

  const text = $('.manifesto__text');
  SplitText.create(text, {
    type: 'words', autoSplit: true,
    onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.12 }, {
      opacity: 1, ease: 'none', stagger: 0.05,
      scrollTrigger: { trigger: text, start: 'top 82%', end: 'bottom 50%', scrub: true },
    }),
  });
}

/* ---------------- Marquees ---------------- */
function buildMarquees() {
  $$('[data-marquee-track]').forEach((track) => {
    const group = () => {
      const g = el('div', 'marquee__group');
      DISHES.forEach((d) => {
        g.append(el('span', 'marquee__item', `${d.name}<img src="${plateSrc(clipOf(d, d.plate))}" alt="" loading="lazy">`));
      });
      return g;
    };
    track.append(group(), group());
  });
}

function marquees() {
  $$('[data-marquee]').forEach((m, k) => {
    const track = $('[data-marquee-track]', m);
    const dir0 = k % 2 ? -1 : 1;
    const tween = gsap.to(track, { xPercent: -50, repeat: -1, duration: k ? 50 : 38, ease: 'none' });
    tween.totalTime(tween.duration() * 200);
    tween.timeScale(dir0);
    if (reduce) { tween.pause(); return; }
    let dir = dir0;
    ScrollTrigger.create({
      trigger: m, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => (self.isActive ? tween.resume() : tween.pause()),
      onUpdate: (self) => {
        dir = dir0 * self.direction;
        const boost = Math.min(6, Math.abs(self.getVelocity()) / 300);
        gsap.to(tween, { timeScale: dir * (1 + boost), duration: 0.2, overwrite: true })
          .then(() => gsap.to(tween, { timeScale: dir, duration: 1.2, ease: 'power2.out' }));
      },
    });
  });
}

/* ---------------- Nav ---------------- */
function nav() {
  const bar = $('[data-nav]');
  const burger = $('[data-burger]');
  const menu = $('[data-navmenu]');
  const bg = prepVideo($('.navmenu__bg', menu));
  let open = false;

  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      bar.classList.toggle('is-solid', y > innerHeight * 0.6);
      if (!open) bar.classList.toggle('is-hidden', self.direction === 1 && y > innerHeight * 0.4);
    },
  });

  const origin = () => {
    const r = burger.getBoundingClientRect();
    return `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  };
  const toggle = (state = !open) => {
    open = state;
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', !open);
    const max = Math.hypot(innerWidth, innerHeight);
    if (open) {
      scroller.lock();
      play(bg);
      gsap.set(menu, { visibility: 'visible' });
      gsap.fromTo(menu, { clipPath: `circle(0px at ${origin()})` }, { clipPath: `circle(${max}px at ${origin()})`, duration: 1, ease: 'expo.inOut' });
      gsap.fromTo('.navmenu__links a', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, stagger: 0.06, ease: 'expo.out', delay: 0.35 });
    } else {
      scroller.unlock();
      gsap.to(menu, { clipPath: `circle(0px at ${origin()})`, duration: 0.8, ease: 'expo.inOut', onComplete: () => { gsap.set(menu, { visibility: 'hidden' }); pause(bg); } });
    }
  };
  burger.addEventListener('click', () => toggle());
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) toggle(false); });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scrollto]');
    if (!a) return;
    e.preventDefault();
    const target = a.getAttribute('href');
    const go = () => (target === '#top' ? scroller.to(document.body, { offset: 0 }) : scroller.to(target));
    if (open) { toggle(false); setTimeout(go, 350); } else go();
  });
}

/* ---------------- Cursor & magnetic buttons (mouse only) ---------------- */
function cursor() {
  if (!mq.fine.matches) return;
  document.documentElement.classList.add('has-cursor');
  const c = el('div', 'cursor', '<div class="cursor__ring"><span></span></div><div class="cursor__dot"></div>');
  document.body.append(c);
  const ring = c.firstElementChild, dot = c.lastElementChild, label = ring.firstElementChild;
  const rx = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  // Real pointer only: the guided tour dispatches its own (untrusted) pointer events.
  addEventListener('pointermove', (e) => { if (!e.isTrusted) return; rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); }, { passive: true });
  // Stretch the ring along its direction of travel, like a drop of liquid.
  let lx = 0, ly = 0;
  gsap.ticker.add(() => {
    const x = gsap.getProperty(ring, 'x'), y = gsap.getProperty(ring, 'y');
    const vx = x - lx, vy = y - ly;
    lx = x; ly = y;
    if (c.classList.contains('has-label')) { gsap.set(ring, { scaleX: 1, scaleY: 1, rotation: 0 }); return; }
    const sp = Math.min(Math.hypot(vx, vy), 70);
    gsap.set(ring, { rotation: sp > 0.5 ? (Math.atan2(vy, vx) * 180) / Math.PI : '+=0', scaleX: 1 + sp / 45, scaleY: Math.max(0.55, 1 - sp / 120) });
  });
  addEventListener('pointerdown', (e) => { if (e.isTrusted) c.classList.add('is-down'); });
  addEventListener('pointerup', (e) => { if (e.isTrusted) c.classList.remove('is-down'); });
  document.addEventListener('pointerover', (e) => {
    if (!e.isTrusted) return;
    const t = e.target.closest?.('[data-cursor]');
    c.classList.toggle('has-label', !!t);
    if (t) label.textContent = t.dataset.cursor;
  });
  document.addEventListener('pointerleave', () => gsap.to(c, { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => gsap.to(c, { opacity: 1, duration: 0.2 }));
}

function magnetic() {
  if (!mq.fine.matches || reduce) return;
  $$('.pill--gold, .susan__play, .round').forEach((b) => {
    const xTo = gsap.quickTo(b, 'x', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    const yTo = gsap.quickTo(b, 'y', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.25);
      yTo((e.clientY - r.top - r.height / 2) * 0.3);
    });
    b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------------- Footer ---------------- */
function footer() {
  $('[data-year]').textContent = new Date().getFullYear();
  const big = $('[data-kain]');
  const split = SplitText.create(big, { type: 'chars', charsClass: 'char' });
  if (!reduce) {
    gsap.from(split.chars, { yPercent: 100, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: big, start: 'top 90%', once: true } });
  }
  const jump = (c) => {
    if (gsap.isTweening(c)) return;
    gsap.timeline()
      .to(c, { yPercent: -28, rotate: gsap.utils.random(-12, 12), duration: 0.28, ease: 'power2.out' })
      .to(c, { yPercent: 0, rotate: 0, duration: 0.9, ease: 'elastic.out(1.1, .35)' });
  };
  split.chars.forEach((c) => {
    c.addEventListener('pointerenter', () => jump(c));
    c.addEventListener('pointerdown', () => jump(c));
  });
}

/* ---------------- Contact info ---------------- */
function fillInfo() {
  $$('[data-info]').forEach((n) => {
    const key = n.dataset.info;
    if (key === 'phone') { n.textContent = INFO.phone; n.href = `tel:${INFO.phone.replace(/\s/g, '')}`; }
    else if (key === 'website') { n.textContent = INFO.website; n.href = `https://${INFO.website}/`; }
    else if (key === 'social') n.innerHTML = INFO.social.map(([name, url]) => `<a href="${url}" target="_blank" rel="noopener">${name}</a>`).join('');
    else n.innerHTML = INFO[key];
  });
}

/* ---------------- Premium polish ---------------- */
function polish() {
  // Ornament dividers draw themselves in.
  $$('[data-orn]').forEach((o) => {
    gsap.from($$('i', o), { scaleX: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: o, start: 'top 88%', once: true } });
    gsap.from($('svg', o), { scale: 0, rotate: -90, duration: 1.2, ease: 'back.out(2)', scrollTrigger: { trigger: o, start: 'top 88%', once: true } });
  });

  // Plates drift past the manifesto at different depths.
  if (!reduce) {
    $$('[data-float]').forEach((img) => {
      const k = +img.dataset.float;
      gsap.fromTo(img, { y: 160 * k, rotate: -8 * k }, { y: -160 * k, rotate: 8 * k, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
    });
  }

  // Menu cards tilt toward the pointer with a light sheen.
  if (!mq.fine.matches || reduce) return;
  $$('.card').forEach((card) => {
    const media = $('.card__media', card);
    const sheen = $('.card__sheen', card);
    const rx = gsap.quickTo(media, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(media, 'rotationY', { duration: 0.6, ease: 'power3' });
    card.addEventListener('pointermove', (e) => {
      const r = media.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      rx((0.5 - py) * 14);
      ry((px - 0.5) * 14);
      sheen.style.setProperty('--mx', `${px * 100}%`);
      sheen.style.setProperty('--my', `${py * 100}%`);
      card.classList.add('is-tilt');
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); card.classList.remove('is-tilt'); });
  });
}
