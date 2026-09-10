/* Tide preloader — a curtain that lifts once, per session. Never traps the visitor. */
import { $, reduce, hasGsap } from './core.js';

let resolveDone;
export const loaderDone = new Promise(r => (resolveDone = r));

(function () {
  const el = $('#loader');
  const html = document.documentElement;
  let done = false;
  function finish() {
    if (done) return; done = true;
    html.classList.remove('loading');
    try { sessionStorage.setItem('lla:seen', '1'); } catch {}
    el?.remove();
    if (hasGsap && typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    resolveDone();
  }
  if (!el || html.classList.contains('no-loader') || reduce) { finish(); return; }

  /* Hard cap: the page is never held hostage by the intro. */
  setTimeout(finish, 2200);

  const start = () => {
    if (done) return;
    if (!hasGsap) { el.classList.add('out'); setTimeout(finish, 700); return; }
    gsap.timeline({ onComplete: finish })
      .to(el.querySelector('.loader-word'), { opacity: 1, y: 0, duration: .45, ease: 'power3.out' })
      .to(el.querySelector('.tide'), { yPercent: -100, duration: .9, ease: 'power2.inOut' }, '-=.15')
      .to(el, { yPercent: -100, duration: .7, ease: 'power3.inOut' }, '-=.2');
  };
  const t = setTimeout(start, 600);
  (document.fonts?.ready || Promise.resolve()).then(() => { clearTimeout(t); start(); });
})();
