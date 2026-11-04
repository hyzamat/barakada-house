// Guided tour: the site explores itself like a visitor would, with a ghost finger that moves,
// hovers and taps, until Stop (or Esc) is pressed. It walks through booking but never submits.
import { $, $$, scroller } from './util.js';

const STOP = Symbol('stop');
const rand = (a, b) => a + Math.random() * (b - a);

export function initTour({ story, menu }) {
  const hud = $('[data-tour]');
  const text = $('[data-tour-text]', hud);
  const bar = $('[data-tour-bar]', hud);
  const ghost = $('[data-tour-cursor]');
  const html = document.documentElement;
  const pos = { x: innerWidth / 2, y: innerHeight * 0.6 };
  let active = false, stopNow = null, stopped = null;

  // ----- Stoppable primitives -----
  const guard = (p) => Promise.race([p, stopped]);
  const wait = (ms) => guard(new Promise((r) => setTimeout(r, ms)));
  const say = (msg, i, n) => {
    text.textContent = msg;
    gsap.fromTo(text, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
    gsap.to(bar, { scaleX: (i + 1) / n, duration: 0.6, ease: 'power2.out' });
  };

  function go(target, { duration = 1.8, offset = 0, linear = false } = {}) {
    return guard(new Promise((res) => {
      const lenis = scroller.lenis;
      if (!lenis) {
        const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY + offset;
        scrollTo({ top: y, behavior: 'smooth' });
        setTimeout(res, duration * 1000);
        return;
      }
      lenis.scrollTo(target, { duration, offset, lock: true, force: true, easing: linear ? (t) => t : undefined, onComplete: res });
    }));
  }

  const ev = (type, x, y, bubbles = true) => new PointerEvent(type, { bubbles, clientX: x, clientY: y, pointerId: 77, pointerType: 'mouse', isPrimary: true, button: 0 });
  // Send enter/leave like a real pointer, so hover effects release when the finger moves on.
  let hovered = null;
  function hoverTo(el, x, y) {
    if (el === hovered) return;
    for (let n = hovered; n && !n.contains(el); n = n.parentElement) n.dispatchEvent(ev('pointerleave', x, y, false));
    for (let n = el; n && !n.contains(hovered); n = n.parentElement) n.dispatchEvent(ev('pointerenter', x, y, false));
    hovered = el;
  }
  function point(type, x, y, target) {
    const el = target || document.elementFromPoint(x, y) || document.body;
    if (type === 'pointermove') hoverTo(el, x, y);
    el.dispatchEvent(ev(type, x, y));
  }

  function move(x, y, duration = 0.9) {
    return guard(new Promise((res) => {
      gsap.to(pos, {
        x, y, duration, ease: 'power2.inOut', overwrite: true,
        onUpdate: () => { gsap.set(ghost, { x: pos.x, y: pos.y }); point('pointermove', pos.x, pos.y); },
        onComplete: res,
      });
    }));
  }
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  async function moveTo(el, duration) { const [x, y] = center(el); await move(x, y, duration); }
  async function tap(el, { real = true } = {}) {
    await moveTo(el, 0.8);
    ghost.classList.remove('is-tap');
    void ghost.offsetWidth;
    ghost.classList.add('is-tap');
    await wait(180);
    if (real) el.click();
    await wait(350);
  }
  async function wander(el, n = 4, dur = 1.1) {
    for (let i = 0; i < n; i++) {
      const r = el.getBoundingClientRect();
      const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
      await move(rand(r.left + r.width * 0.15, r.right - r.width * 0.15), rand(top + (bottom - top) * 0.2, bottom - (bottom - top) * 0.2), dur);
    }
  }
  const focus = (els) => {
    $$('.tour-focus').forEach((e) => e.classList.remove('tour-focus'));
    [].concat(els || []).forEach((e) => e?.classList.add('tour-focus'));
  };
  // Sample guest the tour types in. Never submitted, and cleared again when the tour ends.
  const SAMPLE = { name: 'Muhammed Ashraf', phone: '+966 55 012 3456', notes: 'Birthday dinner, a table near the grill please' };
  let picked = null;
  async function type(input, value) {
    const field = input.closest('.field');
    await moveTo(field, 0.8);
    focus(field);
    input.value = '';
    for (const ch of value) {
      input.value += ch;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(rand(45, 110));
    }
    await wait(350);
  }
  function clearSample() {
    const form = $('[data-book]');
    for (const [key, value] of Object.entries(SAMPLE)) {
      const input = form.elements[key];
      if (input.value && value.startsWith(input.value)) input.value = '';
    }
    if (picked?.getAttribute('aria-pressed') === 'true') picked.click();
    picked = null;
  }

  // Keep the HUD and finger usable on top of an open dialog by moving them inside it.
  const mount = (el = document.body) => el.append(hud, ghost);
  const sectionTop = (id) => $(id);

  // ----- The route -----
  const STEPS = [
    ['Welcome to Barkada House', async () => {
      await go(0, { duration: 1.2 });
      await wait(600);
      const title = $('.film__title');
      const r = title.getBoundingClientRect();
      await move(r.left + 10, r.top + r.height * 0.55, 1);
      await move(r.right - 10, r.top + r.height * 0.45, 2.4);
      await wait(400);
    }],
    ['Playing the kitchen film', async () => {
      const sec = sectionTop('#top');
      let done = false;
      const film = go(sec.offsetTop + sec.offsetHeight - innerHeight, { duration: 24, linear: true }).then(() => { done = true; });
      film.catch(() => {});
      while (!done) await move(rand(innerWidth * 0.2, innerWidth * 0.8), rand(innerHeight * 0.3, innerHeight * 0.75), 1.6);
      await film;
      await wait(800);
    }],
    ['Everyone brings something', async () => {
      const sec = sectionTop('#ingredients');
      await go(sec, { duration: 1.8 });
      await wander(sec, 5, 1);
      const [x, y] = center(sec);
      await move(x, y, 0.7);
      ghost.classList.remove('is-tap'); void ghost.offsetWidth; ghost.classList.add('is-tap');
      point('pointerdown', x, y, sec);
      await wait(2200);
    }],
    ['A house built for the barkada', async () => {
      const sec = sectionTop('#about');
      await go(sec, { duration: 1.6, offset: -40 });
      await go(sec.offsetTop + sec.offsetHeight - innerHeight, { duration: 6, linear: true });
      await wait(600);
    }],
    ['Spinning the lazy susan', async () => {
      const sec = sectionTop('#table');
      await go($('[data-table]', sec), { duration: 1.8, offset: -innerHeight * 0.55 });
      await wait(1200);
      const next = $('[data-step="1"]', sec);
      for (let i = 0; i < 3; i++) { await tap(next); await wait(1700); }
    }],
    ['Watching how it is made', async () => {
      await tap($('.susan__info [data-act="story"]'));
      const dlg = $('[data-story]');
      mount(dlg);
      await wait(4200);
      const zone = $('[data-s-zones]', dlg);
      for (let i = 0; i < 2; i++) {
        const r = zone.getBoundingClientRect();
        const x = r.right - 40, y = r.top + r.height / 2;
        await move(x, y, 0.8);
        ghost.classList.remove('is-tap'); void ghost.offsetWidth; ghost.classList.add('is-tap');
        point('pointerdown', x, y, zone);
        point('pointerup', x, y, zone);
        await wait(3800);
      }
      story.close();
      await wait(500);
      mount();
    }],
    ['Charcoal, smoke and fire', async () => {
      const sec = sectionTop('#fire');
      await go(sec, { duration: 1.8, offset: innerHeight * 0.25 });
      await wander(sec, 5, 0.9);
      await wait(500);
    }],
    ['Tossing the wok', async () => {
      const sec = sectionTop('#toss');
      await go(sec, { duration: 1.6 });
      let done = false;
      const toss = go(sec.offsetTop + sec.offsetHeight - innerHeight, { duration: 8, linear: true }).then(() => { done = true; });
      toss.catch(() => {});
      while (!done) await move(rand(innerWidth * 0.3, innerWidth * 0.8), rand(innerHeight * 0.2, innerHeight * 0.6), 1.4);
      await toss;
    }],
    ['Browsing the menu', async () => {
      const sec = sectionTop('#menu');
      await go($('[data-chips]', sec), { duration: 1.8, offset: -innerHeight * 0.3 });
      for (const cat of ['inihaw', 'sabaw', 'all']) { await tap($(`.chip[data-cat="${cat}"]`)); await wait(1500); }
    }],
    ['A closer look at Kare-Kare', async () => {
      const card = $('.card[data-id="kare-kare"]');
      await go(card, { duration: 1.2, offset: -innerHeight * 0.25 });
      await moveTo($('.card__media', card), 0.8);
      await wait(1200);
      await tap($('[data-open]', card));
      const dlg = $('[data-dish]');
      mount(dlg);
      await wait(2400);
      $('.sheet__panel', dlg).scrollTo({ top: 520, behavior: 'smooth' });
      await wait(2600);
      menu.closeDish();
      await wait(600);
      mount();
    }],
    ['Booking guide: how many are coming?', async () => {
      const sec = sectionTop('#reserve');
      const party = $('.party', sec);
      await go(party, { duration: 1.8, offset: -innerHeight * 0.3 });
      focus(party.closest('.book__group'));
      const plus = $('[data-party="1"]', sec);
      for (let i = 0; i < 2; i++) await tap(plus);
      await wait(900);
    }],
    ['Booking guide: pick a day and time', async () => {
      const sec = sectionTop('#reserve');
      const day = $$('.date', sec)[2];
      focus(day.closest('.book__group'));
      await tap(day);
      await wait(700);
      const time = $$('.time:not(:disabled)', sec).find((t) => t.dataset.time === '20:00') || $('.time:not(:disabled)', sec);
      await go(time, { duration: 1, offset: -innerHeight * 0.4 });
      focus(time.closest('.book__group'));
      await tap(time);
      await wait(900);
    }],
    ['Booking guide: what are we celebrating?', async () => {
      const chip = $$('[data-occasions] .tagbtn').find((b) => b.textContent === 'Birthday');
      await go(chip, { duration: 1, offset: -innerHeight * 0.45 });
      focus(chip.closest('.book__group'));
      if (chip.getAttribute('aria-pressed') !== 'true') { await tap(chip); picked = chip; }
      await wait(900);
    }],
    ['Booking guide: your details (sample only)', async () => {
      const form = $('[data-book]');
      await go($('.book__fields', form), { duration: 1.2, offset: -innerHeight * 0.4 });
      for (const key of Object.keys(SAMPLE)) await type(form.elements[key], SAMPLE[key]);
      focus(null);
    }],
    ['We stop here. Nothing is booked', async () => {
      const submit = $('.book__submit');
      focus(submit);
      await moveTo(submit, 0.9);
      await wait(2600);
      focus(null);
    }],
    ['See you at Barkada House', async () => {
      await go(document.documentElement.scrollHeight, { duration: 2 });
      for (const c of $$('.foot__big .char')) {
        await moveTo(c, 0.25);
        c.dispatchEvent(new PointerEvent('pointerenter'));
      }
      await wait(1800);
    }],
  ];

  async function start() {
    if (active) return;
    active = true;
    stopped = new Promise((_, rej) => { stopNow = () => rej(STOP); });
    stopped.catch(() => {});
    html.classList.add('is-touring');
    hud.hidden = false;
    gsap.fromTo(hud, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
    gsap.set(ghost, { x: pos.x, y: pos.y });
    try {
      for (;;) {
        for (let i = 0; i < STEPS.length; i++) {
          say(STEPS[i][0], i, STEPS.length);
          await STEPS[i][1]();
        }
      }
    } catch (e) {
      if (e !== STOP) console.error(e);
    } finally {
      finish();
    }
  }

  function finish() {
    active = false;
    gsap.killTweensOf(pos);
    scroller.lenis?.scrollTo(scrollY, { immediate: true, force: true });
    story.close();
    menu.closeDish();
    mount();
    hoverTo(null, pos.x, pos.y);
    focus(null);
    clearSample();
    html.classList.remove('is-touring');
    gsap.to(hud, { y: 30, opacity: 0, duration: 0.4, onComplete: () => { if (!active) hud.hidden = true; } });
  }

  const stop = () => { if (active) stopNow(); };
  $$('[data-tour-start]').forEach((b) => b.addEventListener('click', start));
  $('[data-tour-stop]', hud).addEventListener('click', stop);
  // Any real input from the visitor ends the tour (the tour's own events are untrusted).
  const userStop = (e) => { if (active && e.isTrusted && !hud.contains(e.target)) stop(); };
  addEventListener('pointerdown', userStop, true);
  addEventListener('wheel', userStop, { passive: true });
  addEventListener('touchstart', userStop, { passive: true });
  addEventListener('keydown', (e) => { if (active && e.isTrusted) stop(); });

  return { start, stop };
}
