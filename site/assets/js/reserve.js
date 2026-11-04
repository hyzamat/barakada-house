// Reservation form. Builds a booking request the guest sends via WhatsApp, plus a calendar file.
// To use your own booking system instead, replace the body of `submit()` with a fetch() to it.
import { INFO, byId, clipOf } from './data.js';
import { $, $$, el, haptic, personIcons, plateSrc, money, scroller } from './util.js';

const OCCASIONS = ['Birthday', 'Barkada reunion', 'Date night', 'Celebration', 'Just because'];
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

  // Dates (next 14 days)
  const dates = $('[data-dates]', form);
  for (let i = 0; i < 14; i++) {
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
  dates.addEventListener('click', (e) => {
    const b = e.target.closest('.date');
    if (!b) return;
    haptic(5);
    $$('.date', dates).forEach((x) => x.setAttribute('aria-pressed', x === b));
    s.date = new Date(+b.dataset.ts);
    renderTimes();
  });

  // Times
  const times = $('[data-times]', form);
  function renderTimes() {
    const now = new Date();
    const isToday = s.date && s.date.toDateString() === now.toDateString();
    times.innerHTML = Object.entries(SLOTS).map(([label, slots]) => `
      <div class="times__group"><p>${label}</p><div class="times__grid">${slots.map((t) => {
        const [h, m] = t.split(':').map(Number);
        const past = isToday && h * 60 + m < now.getHours() * 60 + now.getMinutes() + 60;
        return `<button type="button" class="time" data-time="${t}" aria-pressed="${s.time === t && !past}" ${past ? 'disabled' : ''}>${t}</button>`;
      }).join('')}</div></div>`).join('');
    if ($(`.time[data-time="${s.time}"]:disabled`, times)) s.time = null;
  }
  times.addEventListener('click', (e) => {
    const b = e.target.closest('.time');
    if (!b || b.disabled) return;
    haptic(5);
    $$('.time', times).forEach((x) => x.setAttribute('aria-pressed', x === b));
    s.time = b.dataset.time;
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
