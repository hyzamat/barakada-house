// Barkada tray: a shared order you can split between friends. Saved in localStorage.
import { byId, clipOf } from './data.js';
import { $, el, icon, plateSrc, money, haptic, store, toast, scroller, personIcons, mq, dragToClose } from './util.js';

export function initTray() {
  let items = store('bh.tray') || {};
  let friends = store('bh.friends') || 4;
  for (const id of Object.keys(items)) if (!byId[id]) delete items[id];

  const fab = $('[data-trayfab]');
  const dlg = $('[data-tray]');
  const panel = $('.sheet__panel', dlg);
  const list = $('[data-tray-list]', dlg);
  const ui = {
    count: $('[data-tray-count]'), total: $('[data-tray-total]'), sum: $('[data-tray-sum]', dlg),
    each: $('[data-each]', dlg), splitN: $('[data-split-n]', dlg), splitSub: $('[data-split-sub]', dlg),
    people: $('[data-split-people]', dlg), empty: $('[data-tray-empty]', dlg), split: $('[data-split-box]', dlg),
    actions: $('.tray__actions', dlg),
  };
  const shown = { total: 0, each: 0 };
  let isOpen = false;

  const count = () => Object.values(items).reduce((a, b) => a + b, 0);
  const total = () => Object.entries(items).reduce((a, [id, n]) => a + byId[id].price * n, 0);
  const save = () => { store('bh.tray', items); store('bh.friends', friends); };

  function render() {
    const n = count(), t = total();
    ui.count.textContent = n;
    fab.classList.toggle('is-on', n > 0);
    ui.empty.hidden = n > 0;
    ui.split.hidden = n === 0;
    ui.actions.hidden = n === 0;
    ui.splitN.textContent = friends;
    ui.splitSub.textContent = `${friends} ${friends === 1 ? 'person' : 'friends'}`;
    ui.people.innerHTML = personIcons(friends, 30);
    gsap.to(shown, {
      total: t, each: Math.ceil(t / friends), duration: 0.6, ease: 'power2.out', overwrite: true,
      onUpdate: () => {
        ui.total.textContent = money(shown.total);
        ui.sum.textContent = money(shown.total);
        ui.each.textContent = money(shown.each);
      },
    });
    list.innerHTML = Object.entries(items).map(([id, q]) => {
      const d = byId[id];
      return `<li class="tray__item" data-id="${id}">
        <img src="${plateSrc(clipOf(d, d.plate))}" alt="">
        <div><strong>${d.name}</strong><span>${money(d.price)} &times; ${q} = ${money(d.price * q)}</span></div>
        <div class="party party--sm">
          <button type="button" class="round" data-d="-1" aria-label="One less ${d.name}">${icon(q === 1 ? 'close' : 'minus')}</button>
          <output class="party__n">${q}</output>
          <button type="button" class="round" data-d="1" aria-label="One more ${d.name}">${icon('plus')}</button>
        </div>
      </li>`;
    }).join('');
    dispatchEvent(new CustomEvent('tray:change', { detail: { items: { ...items }, friends, total: t } }));
  }

  function add(id, from, qty = 1) {
    items[id] = (items[id] || 0) + qty;
    save();
    haptic(14);
    if (from && !from.closest('dialog') && !mq.reduce.matches) fly(id, from);
    else bump();
    render();
    toast(`${byId[id].name} added to your tray`);
  }

  function fly(id, from) {
    const d = byId[id];
    const r = from.getBoundingClientRect();
    const img = el('img', 'fly');
    img.src = plateSrc(clipOf(d, d.plate));
    img.alt = '';
    document.body.append(img);
    const x0 = r.left + r.width / 2 - 27, y0 = r.top + r.height / 2 - 27;
    // Where the tray icon sits once the button is shown (offset* ignores the hide transform).
    const x1 = fab.offsetLeft - fab.offsetWidth / 2 + 7 + 22 - 27;
    const y1 = fab.offsetTop + 7 + 22 - 27;
    gsap.set(img, { x: x0, y: y0, scale: 0.5 });
    gsap.timeline({ onComplete: () => { img.remove(); bump(); } })
      .to(img, { x: x1, duration: 0.85, ease: 'power1.inOut' }, 0)
      .to(img, { y: Math.min(y0, y1) - 140, duration: 0.38, ease: 'power2.out' }, 0)
      .to(img, { y: y1, duration: 0.47, ease: 'power2.in' }, 0.38)
      .to(img, { scale: 1.1, rotation: 200, duration: 0.5 }, 0)
      .to(img, { scale: 0.45, duration: 0.35 }, 0.5);
  }

  function bump() {
    gsap.fromTo('.trayfab__icon', { scale: 1.3 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, .35)' });
  }

  function change(id, delta) {
    items[id] = (items[id] || 0) + delta;
    if (items[id] <= 0) delete items[id];
    save();
    haptic(6);
    render();
    if (!count()) setTimeout(close, 500);
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    render();
    dlg.showModal();
    scroller.lock();
    const desktop = matchMedia('(min-width: 900px)').matches;
    gsap.fromTo(panel, desktop ? { xPercent: 100 } : { yPercent: 100 }, { xPercent: 0, yPercent: 0, y: 0, duration: 0.7, ease: 'expo.out' });
    gsap.from('.tray__item', { x: 30, opacity: 0, stagger: 0.05, duration: 0.6, ease: 'expo.out', delay: 0.15 });
  }
  function close(after) {
    if (!isOpen) return;
    isOpen = false;
    const desktop = matchMedia('(min-width: 900px)').matches;
    gsap.to(panel, {
      ...(desktop ? { xPercent: 100 } : { yPercent: 100 }), duration: 0.45, ease: 'power3.in',
      onComplete: () => { dlg.close(); gsap.set(panel, { clearProps: 'all' }); scroller.unlock(); if (typeof after === 'function') after(); },
    });
  }

  fab.addEventListener('click', open);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  $('[data-close]', dlg).addEventListener('click', close);
  dragToClose(panel, $('[data-grab]', dlg), close);
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (b) change(b.closest('[data-id]').dataset.id, +b.dataset.d);
  });
  dlg.querySelectorAll('[data-split]').forEach((b) => b.addEventListener('click', () => {
    friends = Math.max(1, Math.min(30, friends + +b.dataset.split));
    save();
    haptic(6);
    render();
  }));
  $('[data-tray-clear]', dlg).addEventListener('click', () => { items = {}; save(); render(); close(); });
  $('[data-tray-reserve]', dlg).addEventListener('click', () => {
    close(() => {
      dispatchEvent(new CustomEvent('tray:reserve', { detail: { friends } }));
      scroller.to('#reserve');
    });
  });

  render();
  return { add, open, refresh: render };
}
