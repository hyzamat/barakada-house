// Reservation form. Builds a booking request the guest sends via WhatsApp, plus a calendar file.
// To use your own booking system instead, replace the body of `submit()` with a fetch() to it.
import { INFO, byId, clipOf } from './data.js';
import { $, $$, el, icon, haptic, personIcons, plateSrc, money, scroller } from './util.js';

const OCCASIONS = ['Birthday', 'Iftar', 'Barkada reunion', 'Date night', 'Celebration', 'Just because'];
const BOOKING_DAYS = 30;
// Earliest and latest time a guest can pick with "Other time".
const OPEN = '12:00', LAST = '23:30';
const SLOTS = {
  Lunch: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00'],
  Dinner: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'],
};

export function initReserve() {
  const form = $('[data-book]');
  const ticket = $('[data-ticket]', form);
  const err = $('[data-err]', form);
  const s = { party: 4, date: null, time: null, occasion: null, tray: {} };
  const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
  const monFmt = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const longFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });

  // Party size
  const partyN = $('[data-party-n]', form);
  const people = $('[data-people]', form);
  const setParty = (n) => {
    s.party = Math.max(1, Math.min(40, n));
    partyN.textContent = s.party;
    people.innerHTML = personIcons(s.party, 20);
    gsap.fromTo(partyN, { scale: 1.25 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, .4)' });
    gsap.from(people.lastElementChild, { scale: 0, duration: 0.4, ease: 'back.out(3)' });
  };
  $$('[data-party]', form).forEach((b) => b.addEventListener('click', () => { haptic(6); setParty(s.party + +b.dataset.party); }));
  setParty(4);

  // Dates: the next BOOKING_DAYS days in one scrolling row, with arrows that jump a week
  const dates = $('[data-dates]', form);
  for (let i = 0; i < BOOKING_DAYS; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const b = el('button', 'date', `<small>${i === 0 ? 'Today' : i === 1 ? 'Tmrw' : dayFmt.format(d)}</small><b>${d.getDate()}</b><small>${monFmt.format(d)}</small>`);
    b.type = 'button';
    b.dataset.ts = d.getTime();
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', longFmt.format(d));
    dates.append(b);
  }
  const weekNav = el('div', 'dates__nav', `<button type="button" class="round" data-week="-1" aria-label="Previous week">${icon('arrow')}</button><button type="button" class="round" data-week="1" aria-label="Next week">${icon('arrow')}</button>`);
  const legend = $('legend', dates.closest('fieldset'));
  legend.classList.add('dates__legend');
  legend.append(weekNav);
  weekNav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-week]');
    if (!b) return;
    const chip = $('.date', dates);
    dates.scrollBy({ left: (chip.offsetWidth + 8) * 7 * +b.dataset.week, behavior: 'smooth' });
  });
  dates.addEventListener('click', (e) => {
    const b = e.target.closest('.date');
    if (!b) return;
    haptic(5);
    $$('.date', dates).forEach((x) => x.setAttribute('aria-pressed', x === b));
    s.date = new Date(+b.dataset.ts);
    renderTimes();
  });

  // Times: fixed lunch and dinner slots, plus "Other time" for any time (e.g. Iftar at sunset)
  const times = $('[data-times]', form);
  const ALL_SLOTS = Object.values(SLOTS).flat();
  // Today, times less than an hour away can't be booked.
  const tooSoon = (t) => {
    const now = new Date();
    if (!s.date || s.date.toDateString() !== now.toDateString()) return false;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m < now.getHours() * 60 + now.getMinutes() + 60;
  };
  function renderTimes() {
    if (s.time && tooSoon(s.time)) s.time = null;
    const custom = s.time && !ALL_SLOTS.includes(s.time) ? s.time : '';
    times.innerHTML = Object.entries(SLOTS).map(([label, slots]) => `
      <div class="times__group"><p>${label}</p><div class="times__grid">${slots.map((t) => {
        const past = tooSoon(t);
        return `<button type="button" class="time" data-time="${t}" aria-pressed="${s.time === t}" ${past ? 'disabled' : ''}>${t}</button>`;
      }).join('')}</div></div>`).join('') + `
      <div class="times__group"><p>Other time</p>
        <label class="time time--custom${custom ? ' is-on' : ''}">
          <span>Choose your own</span>
          <input type="time" min="${OPEN}" max="${LAST}" step="900" value="${custom}" data-custom-time aria-label="Choose another time">
        </label>
      </div>`;
  }
  times.addEventListener('click', (e) => {
    const b = e.target.closest('.time[data-time]');
    if (!b || b.disabled) return;
    haptic(5);
    $$('.time[data-time]', times).forEach((x) => x.setAttribute('aria-pressed', x === b));
    const custom = $('[data-custom-time]', times);
    custom.value = '';
    custom.closest('.time--custom').classList.remove('is-on');
    s.time = b.dataset.time;
  });
  times.addEventListener('change', (e) => {
    const input = e.target.closest('[data-custom-time]');
    if (!input) return;
    const label = input.closest('.time--custom');
    const v = input.value;
    err.textContent = '';
    const reject = (msg) => {
      err.textContent = msg;
      input.value = '';
      label.classList.remove('is-on');
      if (!ALL_SLOTS.includes(s.time)) s.time = null;
    };
    if (!v) return reject('');
    if (v < OPEN || v > LAST) return reject(`We take bookings between ${OPEN} and ${LAST}.`);
    if (tooSoon(v)) return reject('Pick a time at least an hour from now.');
    haptic(5);
    $$('.time[data-time]', times).forEach((x) => x.setAttribute('aria-pressed', 'false'));
    label.classList.add('is-on');
    s.time = v;
  });
  $('.date', dates).click();

  // Occasion
  const occ = $('[data-occasions]', form);
  occ.innerHTML = OCCASIONS.map((o) => `<button type="button" class="tagbtn" aria-pressed="false">${o}</button>`).join('');
  occ.addEventListener('click', (e) => {
    const b = e.target.closest('.tagbtn');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    $$('.tagbtn', occ).forEach((x) => x.setAttribute('aria-pressed', on && x === b));
    s.occasion = on ? b.textContent : null;
  });

  // Pre-order from the tray
  const pre = $('[data-preorder]', form);
  addEventListener('tray:change', (e) => {
    s.tray = e.detail.items;
    const ids = Object.keys(s.tray);
    pre.hidden = !ids.length;
    if (!ids.length) return;
    const n = Object.values(s.tray).reduce((a, b) => a + b, 0);
    pre.innerHTML = `<span class="imgs">${ids.slice(0, 4).map((id) => `<img src="${plateSrc(clipOf(byId[id], byId[id].plate))}" alt="">`).join('')}</span>
      <span>Pre-order: <b>${n} dish${n > 1 ? 'es' : ''}</b> &middot; ${money(e.detail.total)}, ready when you arrive.</span>`;
  });
  addEventListener('tray:reserve', (e) => setParty(e.detail.friends));

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name, phone = form.elements.phone;
    $$('.field', form).forEach((f) => f.classList.remove('is-bad'));
    let msg = '';
    if (!s.time) msg = 'Pick a time for your table.';
    else if (name.value.trim().length < 2) { msg = 'Tell us your name.'; name.parentElement.classList.add('is-bad'); }
    else if (phone.value.replace(/\D/g, '').length < 7) { msg = 'Add a mobile number so we can confirm.'; phone.parentElement.classList.add('is-bad'); }
    err.textContent = msg;
    if (msg) {
      haptic([20, 40, 20]);
      gsap.fromTo(form.querySelector('.book__submit'), { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, .3)' });
      return;
    }
    const btn = $('.book__submit', form);
    btn.classList.add('is-busy');
    setTimeout(() => { btn.classList.remove('is-busy'); showTicket(name.value.trim(), phone.value.trim(), form.elements.notes.value.trim()); }, 650);
  });

  function showTicket(name, phone, notes) {
    const ref = 'BH-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const when = longFmt.format(s.date);
    const preIds = Object.keys(s.tray);
    const rows = [
      ['Name', name], ['Guests', `${s.party} ${s.party === 1 ? 'person' : 'people'}`],
      ['Date', when], ['Time', s.time],
      ...(s.occasion ? [['Occasion', s.occasion]] : []),
      ...(preIds.length ? [['Pre-order', preIds.map((id) => `${s.tray[id]}× ${byId[id].name}`).join(', ')]] : []),
    ];
    $('[data-t-title]', ticket).textContent = `Table for ${s.party}`;
    $('[data-t-rows]', ticket).innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('[data-t-ref]', ticket).textContent = ref;

    const text = [`Hi Barkada House! I'd like to book a table.`, ...rows.map(([k, v]) => `${k}: ${v}`), `Phone: ${phone}`, ...(notes ? [`Notes: ${notes}`] : []), `Ref: ${ref}`].join('\n');
    $('[data-t-send]', ticket).href = `https://wa.me/${INFO.whatsapp}?text=${encodeURIComponent(text)}`;
    $('[data-t-ics]', ticket).onclick = () => downloadIcs(ref);

    ticket.hidden = false;
    haptic([10, 30, 10]);
    const card = $('.ticket__card', ticket);
    scroller.to(card, { offset: -Math.max(70, (innerHeight - card.offsetHeight) / 2), duration: 0.9 });
    gsap.fromTo(ticket, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    gsap.fromTo(card, { y: 80, rotate: -4, scale: 0.9 }, { y: 0, rotate: 0, scale: 1, duration: 1, ease: 'elastic.out(1, .6)' });
    confetti(card);
  }

  $('[data-t-close]', ticket).addEventListener('click', () => {
    gsap.to(ticket, { opacity: 0, duration: 0.3, onComplete: () => { ticket.hidden = true; } });
  });

  function downloadIcs(ref) {
    const [h, m] = s.time.split(':').map(Number);
    const start = new Date(s.date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600e3);
    const f = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barkada House//Booking//EN', 'BEGIN:VEVENT',
      `UID:${ref}@barkadahouse`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:Barkada House · table for ${s.party}`, `DESCRIPTION:Booking request ${ref}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `barkada-house-${ref}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}

function confetti(anchor) {
  const r = anchor.getBoundingClientRect();
  const colors = ['#dcaa52', '#f2cd7e', '#e45b2c', '#7d9a56', '#f3eadb', '#c4352a'];
  for (let i = 0; i < 46; i++) {
    const p = el('span');
    const size = gsap.utils.random(6, 12);
    Object.assign(p.style, {
      position: 'fixed', left: `${r.left + r.width / 2}px`, top: `${r.top + 60}px`, zIndex: 450,
      width: `${size}px`, height: `${size * gsap.utils.random(0.4, 1)}px`, borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      background: colors[i % colors.length], pointerEvents: 'none',
    });
    document.body.append(p);
    gsap.timeline({ onComplete: () => p.remove() })
      .to(p, { x: gsap.utils.random(-220, 220), y: gsap.utils.random(-260, -80), rotation: gsap.utils.random(-540, 540), duration: 0.7, ease: 'power3.out' })
      .to(p, { y: `+=${gsap.utils.random(300, 520)}`, opacity: 0, rotation: '+=180', duration: gsap.utils.random(1, 1.6), ease: 'power1.in' });
  }
}
