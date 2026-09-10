/* Island map: hover/tap a spot, read the place card. */
import { $, $$, reduce, hasGsap } from './core.js';
import { PLACES, MATCH_TO_SPOT } from './data.js';

export function showPlace(id) {
  const d = PLACES[id]; if (!d) return;
  $$('.map .spot').forEach(s => s.classList.toggle('hot', s.dataset.id === id));
  const el = $('#place'); if (!el) return;
  el.innerHTML = `<span class="k">${d.k}</span><h3>${d.h}</h3><p>${d.p}</p><div class="facts">${d.f.map(f => `<span>${f}</span>`).join('')}</div><button class="btn" type="button" data-ask="${d.ask.replace(/"/g, '&quot;')}">Ask the concierge about it <span class="arr">→</span></button>`;
  if (hasGsap && !reduce) gsap.from(el.children, { opacity: 0, y: 14, duration: .6, stagger: .06, ease: 'power3.out' });
  document.dispatchEvent(new CustomEvent('lla:place', { detail: { id } }));
}

export function lightMap(areaName) {
  const key = Object.keys(MATCH_TO_SPOT).find(k => String(areaName).toLowerCase().includes(k));
  if (key) showPlace(MATCH_TO_SPOT[key]);
}

(function () {
  const spots = $$('.map .spot'); if (!spots.length) return;
  spots.forEach(s => { s.addEventListener('click', () => showPlace(s.dataset.id)); s.addEventListener('mouseenter', () => showPlace(s.dataset.id)); });
  showPlace('historic');
})();
