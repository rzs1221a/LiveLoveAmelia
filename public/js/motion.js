/* Nav, drawer, split-text reveals, counters, the pinned community reel, testimonials. */
import { $, $$, reduce, hasGsap, reveal } from './core.js';

/* ---------- Nav ---------- */
(function () {
  const nav = $('#nav'); const hero = $('.hero'); if (!nav || !hero) return;
  let last = 0;
  function inView(el) { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }
  function upd() {
    const y = scrollY; const past = y > hero.offsetHeight - 80;
    nav.classList.toggle('solid', y > 40);
    nav.classList.toggle('hide', y > last && y > 300 && past);
    last = y;
    const conc = $('#concierge'), fab = $('#fab');
    if (fab && conc) fab.classList.toggle('show', y > 700 && !inView(conc));
  }
  addEventListener('scroll', upd, { passive: true }); upd();
  const drawer = $('#drawer');
  $('#burger').onclick = () => drawer.classList.add('open');
  $('#drawerX').onclick = () => drawer.classList.remove('open');
  $$('#drawer a').forEach(a => a.onclick = () => drawer.classList.remove('open'));
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
