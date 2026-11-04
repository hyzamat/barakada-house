// Full-screen "how it's made" stories: tap to skip, hold to pause, swipe to change dish or close.
import { DISHES, byId, clipOf } from './data.js';
import { $, $$, clipSrc, posterSrc, plateSrc, money, pad, haptic, scroller, store, icon } from './util.js';

export function initStory({ addToTray }) {
  const dlg = $('[data-story]');
  const media = $('[data-s-media]', dlg);
  const vids = $$('.story__v', dlg);
  const bars = $('[data-s-bars]', dlg);
  const zone = $('[data-s-zones]', dlg);
  const ui = {
    plate: $('[data-s-plate]', dlg), name: $('[data-s-name]', dlg), sub: $('[data-s-sub]', dlg),
    num: $('[data-s-num]', dlg), cap: $('[data-s-cap]', dlg), add: $('[data-s-add]', dlg),
    mute: $('[data-s-mute]', dlg), next: $('[data-s-next]', dlg), close: $('[data-s-close]', dlg),
  };
  let dish = null, idx = 0, active = 0, raf = 0, holding = false, isOpen = false;
  let muted = store('bh.muted') ?? true;
  if (store('bh.storySeen')) dlg.classList.add('is-seen');

  vids.forEach((v) => {
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.addEventListener('ended', () => { if (v === vids[active] && !holding) go(idx + 1); });
  });

  function setSrc(v, id) {
    if (v.dataset.clip === id) return;
    v.dataset.clip = id;
    v.poster = posterSrc(id);
    v.src = clipSrc(id);
  }

  function open(id, step = 0) {
    dish = byId[id];
    if (!isOpen) {
      isOpen = true;
      dlg.showModal();
      scroller.lock();
      gsap.fromTo(dlg, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'expo.out' });
      setTimeout(() => { dlg.classList.add('is-seen'); store('bh.storySeen', true); }, 6000);
    }
    renderMute();
    setDish();
    go(step);
  }

  function setDish() {
    bars.innerHTML = dish.steps.map(() => '<div class="story__bar"><i></i></div>').join('');
    ui.plate.src = plateSrc(clipOf(dish, dish.plate));
    ui.name.textContent = dish.name;
    ui.add.innerHTML = `${icon('plus')} Add to tray &middot; ${money(dish.price)}`;
  }

  function go(i) {
    if (i >= dish.steps.length) return switchDish(1);
    idx = Math.max(0, i);
    const step = dish.steps[idx];
    const shown = vids[active];
    let v = shown;
    if (shown.dataset.clip !== step.id) {
      active = 1 - active;
      v = vids[active];
      setSrc(v, step.id);
    }
    v.muted = muted;
    try { v.currentTime = 0; } catch { /* not loaded yet */ }
    vids.forEach((x) => x.classList.toggle('is-on', x === v));
    const other = vids[1 - active];
    other.pause();
    v.play().catch(() => { v.muted = true; muted = true; renderMute(); v.play().catch(() => {}); });

    $$('.story__bar i', bars).forEach((b, j) => b.style.setProperty('--p', j < idx ? 1 : 0));
    ui.num.textContent = pad(idx + 1);
    ui.sub.textContent = `Step ${idx + 1} of ${dish.steps.length}`;
    ui.cap.innerHTML = step.caption.split(' ').map((w) => `<span class="word">${w}</span>`).join(' ');
    gsap.from($$('.word', ui.cap), { yPercent: 70, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.035 });
    gsap.from(ui.num, { yPercent: 40, opacity: 0, duration: 0.6, ease: 'expo.out' });

    // Preload what comes next into the hidden video once the crossfade is done.
    const nextId = dish.steps[idx + 1]?.id ?? DISHES[(DISHES.indexOf(dish) + 1) % DISHES.length].steps[0].id;
    setTimeout(() => {
      if (!isOpen || vids[1 - active] !== other) return;
      other.preload = 'auto';
      setSrc(other, nextId);
    }, 450);
    tick();
  }

  function tick() {
    cancelAnimationFrame(raf);
    const bar = $$('.story__bar i', bars)[idx];
    const loop = () => {
      const v = vids[active];
      if (v.duration) bar?.style.setProperty('--p', Math.min(1, v.currentTime / v.duration));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function switchDish(dir) {
    const i = (DISHES.indexOf(dish) + dir + DISHES.length) % DISHES.length;
    dish = DISHES[i];
    haptic(10);
    setDish();
    gsap.fromTo(media, { xPercent: 18 * dir, opacity: 0.2 }, { xPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
    go(0);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    cancelAnimationFrame(raf);
    gsap.to(dlg, {
      opacity: 0, scale: 0.96, duration: 0.35, ease: 'power2.in',
      onComplete: () => {
        vids.forEach((v) => v.pause());
        dlg.close();
        gsap.set([dlg, media], { clearProps: 'all' });
        scroller.unlock();
      },
    });
  }

  function renderMute() {
    ui.mute.innerHTML = icon(muted ? 'mute' : 'sound');
    ui.mute.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  }
  ui.mute.addEventListener('click', () => {
    muted = !muted;
    store('bh.muted', muted);
    vids[active].muted = muted;
    if (!muted) vids[active].play().catch(() => {});
    renderMute();
  });
  ui.close.addEventListener('click', close);
  ui.next.addEventListener('click', () => switchDish(1));
  ui.add.addEventListener('click', () => addToTray(dish.id, ui.add));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });

  // Gestures
  let sx = 0, sy = 0, down = false, moved = false, holdTimer = 0;
  zone.addEventListener('pointerdown', (e) => {
    down = true; moved = false; sx = e.clientX; sy = e.clientY;
    try { zone.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    holdTimer = setTimeout(() => {
      holding = true;
      dlg.classList.add('is-holding');
      vids[active].pause();
    }, 230);
  });
  zone.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) > 10) { moved = true; clearTimeout(holdTimer); }
    if (moved && !holding && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      gsap.set(media, { y: dy * 0.6, scale: 1 - Math.min(dy, 400) / 2000 });
    }
  });
  const up = (e) => {
    if (!down) return;
    down = false;
    clearTimeout(holdTimer);
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (holding) {
      holding = false;
      dlg.classList.remove('is-holding');
      vids[active].play().catch(() => {});
      return;
    }
    if (moved && dy > 90 && dy > Math.abs(dx)) return close();
    gsap.to(media, { y: 0, scale: 1, duration: 0.4, ease: 'expo.out' });
    if (moved && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return switchDish(dx < 0 ? 1 : -1);
    if (!moved) {
      const r = zone.getBoundingClientRect();
      go(e.clientX - r.left < r.width / 3 ? idx - 1 : idx + 1);
    }
  };
  zone.addEventListener('pointerup', up);
  zone.addEventListener('pointercancel', (e) => { holding = false; dlg.classList.remove('is-holding'); up(e); });

  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(idx + 1);
    else if (e.key === 'ArrowLeft') go(idx - 1);
    else if (e.key === 'ArrowDown') switchDish(1);
    else if (e.key === 'ArrowUp') switchDish(-1);
    else if (e.key === ' ') {
      e.preventDefault();
      const v = vids[active];
      v.paused ? v.play() : v.pause();
    }
  });

  return { open, close };
}
