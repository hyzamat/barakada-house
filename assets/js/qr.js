// "Scan to book": a QR popup on the hero that opens the site on a phone.
// The same code is pinned on the left during the guided tour (see tour.js).
import { $, $$, haptic, scroller } from './util.js';

export function initQr() {
  const dlg = $('[data-qr]');
  const card = $('.qr__card', dlg);
  let isOpen = false;

  function open() {
    if (isOpen) return;
    isOpen = true;
    haptic(8);
    dlg.showModal();
    scroller.lock();
    gsap.fromTo(card, { y: 40, scale: 0.92, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out' });
    gsap.fromTo($$('.eyebrow, h2, .qr__code, .qr__hint', card), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    gsap.to(card, {
      y: 24, scale: 0.96, opacity: 0, duration: 0.35, ease: 'power3.in',
      onComplete: () => { dlg.close(); gsap.set(card, { clearProps: 'all' }); scroller.unlock(); },
    });
  }

  $$('[data-qr-open]').forEach((b) => b.addEventListener('click', open));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  $('[data-close]', dlg).addEventListener('click', close);

  return { open, close };
}
