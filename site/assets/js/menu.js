// Menu grid with animated filters, the text carte, and the dish detail sheet.
import { DISHES, CATEGORIES, CARTE, byId, clipOf } from './data.js';
import { $, $$, el, mq, icon, posterSrc, plateSrc, prepVideo, autoplay, play, pause, peso, pad, scroller, dragToClose } from './util.js';

export function initMenu({ openStory, addToTray }) {
  const grid = $('[data-grid]');
  const chips = $('[data-chips]');
  const ind = $('.chips__ind', chips);

  // Filters
  CATEGORIES.forEach(([key, label, sub], i) => {
    const b = el('button', 'chip', `${label}${sub ? `<small>${sub}</small>` : ''}`);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.cat = key;
    b.setAttribute('aria-selected', i === 0);
    chips.append(b);
  });
  const moveInd = (b, animate = true) => gsap.to(ind, { x: b.offsetLeft, width: b.offsetWidth, duration: animate ? 0.6 : 0, ease: 'expo.out' });
  requestAnimationFrame(() => moveInd($('.chip', chips), false));
  addEventListener('resize', () => moveInd($('.chip[aria-selected="true"]', chips), false));
  document.fonts?.ready.then(() => moveInd($('.chip[aria-selected="true"]', chips), false));

  // Cards
  const cards = DISHES.map((d) => {
    const cover = clipOf(d, d.cover);
    const tag = d.tags[0];
    const c = el('article', 'card');
    c.dataset.id = d.id;
    c.dataset.cats = d.cats.join(' ');
    c.innerHTML = `
      <button class="card__media" data-open aria-label="View ${d.name}" data-cursor="View">
        <img src="${posterSrc(cover, 'p')}" alt="${d.name}" loading="lazy" decoding="async">
        <video muted playsinline loop preload="none"></video>
        <span class="card__tags"><span class="tag${tag === 'Spicy' ? ' tag--hot' : ''}">${tag}</span></span>
      </button>
      <button class="card__add" data-add aria-label="Add ${d.name} to tray">${icon('plus')}</button>
      <div class="card__body">
        <div class="card__row"><h3>${d.name}</h3><span class="price">${peso(d.price)}</span></div>
        <p class="card__local">${d.local}</p>
        <p class="card__short">${d.short}</p>
      </div>`;
    const v = prepVideo($('video', c), cover, { o: 'p' });
    if (mq.fine.matches) {
      c.addEventListener('pointerenter', () => play(v));
      c.addEventListener('pointerleave', () => { pause(v); v.classList.remove('is-playing'); });
    } else {
      autoplay(v, { band: true });
    }
    $('[data-open]', c).addEventListener('click', () => openDish(d.id));
    $('[data-add]', c).addEventListener('click', (e) => {
      const b = e.currentTarget;
      addToTray(d.id, b);
      b.classList.add('is-added');
      setTimeout(() => b.classList.remove('is-added'), 1200);
    });
    grid.append(c);
    return c;
  });

  if (!mq.reduce.matches) {
    ScrollTrigger.batch(cards, {
      start: 'top 92%', once: true,
      onEnter: (batch) => gsap.from(batch, { y: 70, opacity: 0, rotate: 1.5, duration: 1.1, ease: 'expo.out', stagger: 0.08 }),
    });
  }

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b || b.getAttribute('aria-selected') === 'true') return;
    $$('.chip', chips).forEach((c) => c.setAttribute('aria-selected', c === b));
    moveInd(b);
    chips.scrollTo({ left: b.offsetLeft - 24, behavior: 'smooth' });
    const cat = b.dataset.cat;
    const state = Flip.getState(cards);
    cards.forEach((c) => { c.style.display = cat === 'all' || c.dataset.cats.split(' ').includes(cat) ? '' : 'none'; });
    Flip.from(state, {
      duration: 0.7, ease: 'power3.inOut', scale: true, absolute: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.15 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.35 }),
      onComplete: () => ScrollTrigger.refresh(),
    });
  });

  // Text carte
  $('[data-carte]').innerHTML = CARTE.map(([title, sub, items]) => `
    <div class="carte__col" data-reveal>
      <h4>${title}<small>${sub}</small></h4>
      <ul>${items.map(([n, s, p]) => `<li><b>${n}</b><i></i><span class="price">${peso(p)}</span><small>${s}</small></li>`).join('')}</ul>
    </div>`).join('');

  // ---------- Dish sheet ----------
  const dlg = $('[data-dish]');
  const panel = $('.sheet__panel', dlg);
  const q = (k) => $(`[data-d-${k}]`, dlg);
  const video = prepVideo(q('video'));
  video.loop = true;
  let current = null, qty = 1, isOpen = false;
  const desktop = () => matchMedia('(min-width: 900px)').matches;

  function fill(d) {
    current = d;
    qty = 1;
    const cover = clipOf(d, d.cover);
    q('poster').src = posterSrc(cover);
    q('poster').alt = d.name;
    video.classList.remove('is-playing');
    video.dataset.clip = cover;
    q('eyebrow').textContent = `${CATEGORIES.find(([k]) => k === d.cats[0])[1]} · Serves ${d.serves}`;
    q('name').textContent = d.name;
    q('local').textContent = d.local;
    q('price').textContent = peso(d.price);
    q('spice').innerHTML = d.spice ? [1, 2, 3].map((n) => icon('chili', n > d.spice ? 'off' : '')).join('') : '';
    q('spice').setAttribute('aria-label', d.spice ? `Spice level ${d.spice} of 3` : '');
    q('tags').innerHTML = d.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    q('desc').textContent = d.desc;
    q('ings').innerHTML = d.ings.map((x) => `<li>${x}</li>`).join('');
    q('stepcount').textContent = `${d.steps.length} steps`;
    q('watch').lastElementChild.textContent = `Watch it made · ${d.steps.length} steps`;
    q('steps').innerHTML = d.steps.map((s, i) => `
      <button class="step" data-step="${i}" data-cursor="Play">
        <span class="step__img"><img src="${plateSrc(s.id)}" alt="" loading="lazy"><b>${pad(i + 1)}</b></span>
        <span class="step__cap">${s.caption}</span>
      </button>`).join('');
    q('pairs').innerHTML = d.pairs.map((id) => {
      const p = byId[id];
      return `<button class="pair" data-pair="${id}"><img src="${plateSrc(clipOf(p, p.plate))}" alt=""><div><strong>${p.name}</strong><span>${p.local} · ${peso(p.price)}</span></div>${icon('arrow')}</button>`;
    }).join('');
    setQty(1);
    q('steps').scrollLeft = 0;
  }

  function setQty(n) {
    qty = Math.max(1, Math.min(20, n));
    q('qty').textContent = qty;
    q('addprice').textContent = `· ${peso(current.price * qty)}`;
  }

  function openDish(id) {
    const d = byId[id];
    if (isOpen) {
      const swap = () => { fill(d); panel.scrollTo({ top: 0 }); play(video); };
      document.startViewTransition ? document.startViewTransition(swap) : swap();
      return;
    }
    fill(d);
    isOpen = true;
    dlg.showModal();
    scroller.lock();
    panel.scrollTop = 0;
    gsap.fromTo(panel, desktop() ? { xPercent: 100 } : { yPercent: 100 }, { xPercent: 0, yPercent: 0, y: 0, duration: 0.75, ease: 'expo.out' });
    gsap.fromTo($$('.dish__body > *', panel), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.03, delay: 0.15 });
    play(video);
  }

  function closeDish() {
    if (!isOpen) return;
    isOpen = false;
    pause(video);
    gsap.to(panel, {
      ...(desktop() ? { xPercent: 100 } : { yPercent: 100 }),
      duration: 0.5, ease: 'power3.in',
      onComplete: () => { dlg.close(); gsap.set(panel, { clearProps: 'all' }); scroller.unlock(); },
    });
  }

  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDish(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDish(); });
  $('[data-close]', dlg).addEventListener('click', closeDish);
  dragToClose(panel, $('[data-grab]', dlg), closeDish);
  $$('[data-qty]', dlg).forEach((b) => b.addEventListener('click', () => setQty(qty + +b.dataset.qty)));
  q('add').addEventListener('click', () => {
    addToTray(current.id, q('add'), qty);
    const label = q('add').firstChild;
    label.textContent = 'Added to tray ✓ ';
    setTimeout(() => { label.textContent = 'Add to tray '; }, 1400);
  });
  q('watch').addEventListener('click', () => { pause(video); openStory(current.id, 0); });
  q('steps').addEventListener('click', (e) => {
    const s = e.target.closest('[data-step]');
    if (s) { pause(video); openStory(current.id, +s.dataset.step); }
  });
  q('pairs').addEventListener('click', (e) => {
    const p = e.target.closest('[data-pair]');
    if (p) openDish(p.dataset.pair);
  });

  return { openDish, closeDish };
}
