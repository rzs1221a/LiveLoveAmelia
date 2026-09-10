/* Side-by-side neighborhood compare. */
import { $, reduce, hasGsap, esc } from './core.js';
import { PLACES, AXES } from './data.js';

(function () {
  const a = $('#cmpA'), b = $('#cmpB'), grid = $('#cmpGrid'), askBtn = $('#cmpAsk');
  if (!a || !b || !grid) return;
  const keys = Object.keys(PLACES);
  const opts = keys.map(k => `<option value="${k}">${esc(PLACES[k].short)}</option>`).join('');
  a.innerHTML = opts; b.innerHTML = opts;
  a.value = 'historic'; b.value = 'plantation';

  function card(key) {
    const d = PLACES[key];
    const rows = AXES.map(([k, label]) =>
      `<div class="cmp-row"><span class="cmp-lbl">${label}</span><span class="bar"><i style="--v:${d.s[k] / 5}"></i></span><span class="cmp-n">${d.s[k]}</span></div>`).join('');
    return `<article class="cmp-card">
      <span class="k">${esc(d.k)}</span>
      <h3>${esc(d.h)}</h3>
      <div class="cmp-rows">${rows}</div>
      <div class="cmp-styles">${d.styles.map(x => `<span class="chip"><i></i>${esc(x)}</span>`).join('')}</div>
      <button class="btn" type="button" data-ask="${esc(d.ask)}">Ask about it <span class="arr">→</span></button>
    </article>`;
  }

  function render() {
    /* Never let both columns be the same place. */
    [...b.options].forEach(o => o.disabled = o.value === a.value);
    [...a.options].forEach(o => o.disabled = o.value === b.value);
    if (a.value === b.value) b.value = keys.find(k => k !== a.value);
    grid.innerHTML = card(a.value) + card(b.value);
    const bars = grid.querySelectorAll('.bar i');
    if (hasGsap && !reduce) gsap.from(bars, { scaleX: 0, duration: .7, stagger: .04, ease: 'power3.out' });
    if (askBtn) askBtn.dataset.ask = `Compare ${PLACES[a.value].h} and ${PLACES[b.value].h} for someone deciding between them — lifestyle, home styles, price direction, and what Kelly would ask me first.`;
  }
  a.addEventListener('change', render);
  b.addEventListener('change', render);
  /* Clicking the island map preselects the left column. */
  document.addEventListener('lla:place', e => { if (e.detail.id !== b.value) { a.value = e.detail.id; render(); } });
  render();
})();
