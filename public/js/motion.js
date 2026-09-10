/* Nav, drawer, split-text reveals, counters, the pinned community reel, testimonials. */
import { $, $$, reduce, hasGsap, reveal } from './core.js';

/* ---------- Nav ---------- */
(function () {
  const nav = $('#nav'); const hero = $('.hero'); if (!nav || !hero) return;
  const fab = $('#fab'), conc = $('#concierge');
  let last = 0, heroH = 0, concTop = 0, concBot = 0, queued = false;

  /* Measure once per layout change rather than twice per scroll event. The
   * old handler read offsetHeight and a bounding rect on every scroll, then
   * wrote classes — a forced synchronous layout on every frame of a scroll. */
  function measure() {
    heroH = hero.offsetHeight;
    if (conc) { const r = conc.getBoundingClientRect(); concTop = r.top + scrollY; concBot = concTop + r.height; }
  }
  function upd() {
    queued = false;
    const y = scrollY;
    nav.classList.toggle('solid', y > 40);
    nav.classList.toggle('hide', y > last && y > 300 && y > heroH - 80);
    last = y;
    if (fab && conc) fab.classList.toggle('show', y > 700 && !(concTop < y + innerHeight && concBot > y));
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', measure, { passive: true });
  if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.addEventListener('refresh', measure);
  (document.fonts?.ready || Promise.resolve()).then(measure).catch(() => {});
  measure(); upd();

  /* Anchor smoothing, since `scroll-behavior:smooth` had to come off <html>. */
  document.addEventListener('click', e => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.pushState(null, '', id);
  });

  const drawer = $('#drawer'), burger = $('#burger'), drawerX = $('#drawerX');
  if (drawer && burger) burger.onclick = () => drawer.classList.add('open');
  if (drawer && drawerX) drawerX.onclick = () => drawer.classList.remove('open');
  if (drawer) $$('#drawer a').forEach(a => a.onclick = () => drawer.classList.remove('open'));
})();

/* ---------- Split text, counters, reveals ---------- */
(function () {
  $$('.split').forEach(el => {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; const i = document.createElement('span'); i.textContent = tok; w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });
  if (hasGsap && !reduce) {
    $$('.split').forEach(el => gsap.to(el.querySelectorAll('.w span'), { y: 0, duration: .9, stagger: .035, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
    $$('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0); const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => el.textContent = o.v.toFixed(dec) });
    });
  } else { $$('.split .w span').forEach(s => s.style.transform = 'none'); $$('[data-count]').forEach(el => el.textContent = el.dataset.count); }
  reveal();
})();

/* ---------- Community reel (pinned horizontal) ---------- */
(function () {
  const track = $('#reel'); if (!track) return;
  if (!hasGsap || reduce || innerWidth < 900) { track.parentElement.style.overflowX = 'auto'; track.style.paddingBottom = '20px'; return; }
  const dist = () => track.scrollWidth - innerWidth;
  gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.reel', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1 } });
})();

/* ---------- Testimonials ---------- */
(function () {
  const qs = $$('#stage .q'), dots = $$('#dots button'); if (!qs.length) return;
  let i = 0, timer;
  function go(n) { i = n % qs.length; qs.forEach((q, k) => q.classList.toggle('on', k === i)); dots.forEach((d, k) => { d.classList.remove('on'); void d.offsetWidth; if (k === i) d.classList.add('on'); }); clearTimeout(timer); if (!reduce) timer = setTimeout(() => go(i + 1), 7000); }
  dots.forEach((d, k) => d.onclick = () => go(k));
  go(0);
})();
