// The lazy susan: a draggable, flingable wheel of plates. The plate at the top is the selected dish.
import { DISHES, clipOf } from './data.js';
import { $, $$, el, plateSrc, posterSrc, prepVideo, play, pause, peso, pad, haptic, mq } from './util.js';

export function initSusan({ openStory, openDish, addToTray }) {
  const root = $('#table');
  const table = $('[data-table]', root);
  const wheel = $('[data-wheel]', root);
  const layers = $('[data-display]', root);
  const ui = {
    name: $('[data-name]', root), local: $('[data-local]', root), short: $('[data-short]', root),
    price: $('[data-price]', root), serves: $('[data-serves]', root), count: $('[data-count]', root),
    meta: $('.susan__meta', root),
  };
  const N = DISHES.length;
  const STEP = 360 / N;
  const state = { rot: 0 };
  const setRot = gsap.quickSetter(wheel, 'rotation', 'deg');
  let cur = -1, spin = null, settleTimer = 0, inView = false, userMoved = false;

  const plates = DISHES.map((d, i) => {
    const b = el('button', 'plate', `<span class="plate__in"><img src="${plateSrc(clipOf(d, d.plate))}" alt="" draggable="false" loading="lazy" decoding="async"></span>`);
    b.type = 'button';
    b.dataset.i = i;
    b.style.setProperty('--a', `${i * STEP}deg`);
    b.setAttribute('aria-label', `${d.name}, ${peso(d.price)}`);
    wheel.append(b);
    return b;
  });

  const radius = () => wheel.offsetWidth * 0.5 - plates[0].offsetWidth * 0.62;
  const indexAt = (rot) => ((Math.round(-rot / STEP) % N) + N) % N;

  function apply() {
    setRot(state.rot);
    const i = indexAt(state.rot);
    if (i !== cur) select(i);
  }

  function select(i) {
    const first = cur === -1;
    cur = i;
    const d = DISHES[i];
    plates.forEach((p, k) => p.classList.toggle('is-active', k === i));
    if (!first && userMoved) haptic(5);

    ui.name.innerHTML = `<span>${d.name}</span>`;
    ui.local.textContent = d.local;
    ui.short.textContent = d.short;
    ui.price.textContent = peso(d.price);
    ui.serves.textContent = `Serves ${d.serves}`;
    ui.count.textContent = `${pad(i + 1)} / ${pad(N)}`;
    if (!first) {
      gsap.fromTo(ui.name.firstChild, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'expo.out' });
      gsap.fromTo([ui.local, ui.short, ui.meta], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.04, overwrite: true });
    }
    showDisplay(d, first);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 220);
  }

  function showDisplay(d, instant) {
    $$('.susan__layer', layers).slice(0, -1).forEach((old) => { gsap.killTweensOf(old); old.remove(); });
    const prev = layers.lastElementChild;
    prev?.querySelector('video')?.pause();
    const layer = el('div', 'susan__layer');
    const img = el('img');
    // Landscape sources: their centre square frames the whole plate.
    img.src = posterSrc(clipOf(d, d.plate), 'l');
    img.alt = d.name;
    img.decoding = 'async';
    const v = prepVideo(el('video'), clipOf(d, d.plate), { o: 'l' });
    v.loop = true;
    v.preload = 'none';
    layer.append(img, v);
    layers.append(layer);
    if (instant) return;
    gsap.fromTo(layer, { clipPath: 'circle(0% at 50% 100%)' }, {
      clipPath: 'circle(72% at 50% 50%)', duration: 0.85, ease: 'expo.out',
      onComplete: () => { if (prev && prev.parentNode && layer.parentNode) prev.remove(); gsap.set(layer, { clearProps: 'clipPath' }); },
    });
  }

  function settle() {
    const v = layers.lastElementChild?.querySelector('video');
    if (v && inView && !spin?.isActive()) play(v);
  }

  function snapTo(target, dur) {
    const final = -Math.round(-target / STEP) * STEP;
    const dist = Math.abs(final - state.rot);
    spin?.kill();
    spin = gsap.to(state, {
      rot: final,
      duration: dur ?? gsap.utils.clamp(0.45, 1.9, 0.35 + dist / 240),
      ease: 'power3.out',
      onUpdate: apply,
      onComplete: settle,
    });
  }
  const step = (dir) => snapTo(-(Math.round(-state.rot / STEP) + dir) * STEP);
  function goTo(i) {
    const base = Math.round(-state.rot / STEP);
    let delta = (((i - base) % N) + N) % N;
    if (delta > N / 2) delta -= N;
    snapTo(-(base + delta) * STEP);
  }

  // Drag / fling
  let down = false, dragging = false, pid = 0, x0 = 0, rot0 = 0, lastX = 0, lastT = 0, vel = 0, suppressClick = false;
  table.addEventListener('pointerdown', (e) => {
    if (e.button || e.target.closest('.susan__nav')) return;
    down = true; dragging = false; pid = e.pointerId;
    x0 = lastX = e.clientX; rot0 = state.rot; lastT = performance.now(); vel = 0;
  });
  table.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== pid) return;
    const dx = e.clientX - x0;
    if (!dragging) {
      if (Math.abs(dx) < 5) return;
      dragging = true; userMoved = true;
      spin?.kill();
      rot0 = state.rot;
      try { table.setPointerCapture(pid); } catch { /* pointer already gone */ }
      table.classList.add('is-dragging');
      root.classList.add('is-touched');
    }
    const now = performance.now();
    const deg = (180 / Math.PI) / radius();
    const inst = ((e.clientX - lastX) * deg) / Math.max(1, now - lastT);
    vel = vel * 0.55 + inst * 0.45;
    lastX = e.clientX; lastT = now;
    state.rot = rot0 + (e.clientX - x0) * deg;
    apply();
  });
  const release = (cancelled) => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    dragging = false;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 60);
    table.classList.remove('is-dragging');
    if (cancelled || performance.now() - lastT > 90) vel = 0;
    snapTo(state.rot + gsap.utils.clamp(-2.2, 2.2, vel) * 280);
  };
  table.addEventListener('pointerup', () => release(false));
  table.addEventListener('pointercancel', () => release(true));

  wheel.addEventListener('click', (e) => {
    if (suppressClick) return;
    const p = e.target.closest('.plate');
    if (!p) return;
    userMoved = true;
    root.classList.add('is-touched');
    const i = +p.dataset.i;
    if (i === cur) openStory(DISHES[i].id);
    else goTo(i);
  });
  $$('[data-step]', root).forEach((b) => b.addEventListener('click', () => { userMoved = true; root.classList.add('is-touched'); step(+b.dataset.step); }));
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('input')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  // Actions
  const dish = () => DISHES[cur];
  $('.susan__display', root).addEventListener('click', () => openStory(dish().id));
  $$('[data-act]', root).forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const act = b.dataset.act;
    if (act === 'story') openStory(dish().id);
    else if (act === 'add') addToTray(dish().id, b);
    else if (act === 'details') openDish(dish().id);
  }));

  // Play only while on screen; spin into place on first view.
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    const v = layers.lastElementChild?.querySelector('video');
    if (!v) return;
    inView ? settle() : pause(v);
  }, { threshold: 0.2 }).observe(root);

  apply();
  if (!mq.reduce.matches) {
    ScrollTrigger.create({
      trigger: root, start: 'top 55%', once: true,
      onEnter: () => {
        if (userMoved) return;
        state.rot = STEP * 6.5;
        spin = gsap.to(state, { rot: 0, duration: 2.4, ease: 'expo.out', onUpdate: apply, onComplete: settle });
      },
    });
  }
}
