/* Kelly's Island Book — the local guide, filterable, every card a conversation starter. */
import { $, reduce, esc, reveal } from './core.js';
import { BOOK, BOOK_CATS } from './data.js';

(function () {
  const tabs = $('#bookTabs'), grid = $('#bookGrid'); if (!tabs || !grid) return;
  let cat = 'all', first = true, source = BOOK;

  tabs.innerHTML = BOOK_CATS.map(([k, label]) =>
    `<button type="button" role="tab" data-cat="${k}" aria-selected="${k === 'all'}">${label}</button>`).join('');

  function render() {
    const list = source.filter(b => cat === 'all' || b.cat === cat);
    grid.innerHTML = list.map(b => `<article class="bcard rv pre">
      <span class="k">${esc(BOOK_CATS.find(c => c[0] === b.cat)?.[1] || b.cat)}${b.when ? ` · ${esc(b.when)}` : ''}</span>
      <h3>${esc(b.name)}</h3>
      <p>${esc(b.blurb)}</p>
      <button class="go" type="button" data-ask="${esc(b.ask)}">Ask the concierge <span class="arr">→</span></button>
    </article>`).join('');
    const cards = [...grid.children];
    if (first) { reveal(cards); first = false; return; }
    /* A filter change happens in view, so stagger the reveal rather than wait for scroll.
       Don't hand these to gsap.from() — it would read the .pre opacity as the end value. */
    cards.forEach((c, i) => setTimeout(() => c.classList.remove('pre'), reduce ? 0 : i * 28));
  }

  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cat = b.dataset.cat;
    [...tabs.children].forEach(x => x.setAttribute('aria-selected', String(x === b)));
    render();
  });
  render();
  /* Kelly's own list, when she has written one, replaces the draft. */
  document.addEventListener('lla:venues', e => { source = e.detail; first = true; render(); });
})();

/* Kelly's own picks, once she has written them in the brain, replace the
 * drafted list. One venue per line, "Name — why". Category is guessed from
 * a leading tag like [eats]; otherwise it files under rituals. */
fetch('/api/brain?public=1').then(r => r.ok ? r.json() : null).then(j => {
  const raw = (j?.venues || '').trim(); if (!raw) return;
  const items = raw.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^\[(beaches|eats|rituals|nature)\]\s*(.*)$/i);
    const cat = m ? m[1].toLowerCase() : 'rituals'; const rest = m ? m[2] : l;
    const [name, ...why] = rest.split(/\s+[—–-]\s+/);
    return { cat, name: name.trim(), blurb: why.join(' — ').trim(), ask: `Tell me about ${name.trim()} on Amelia Island.` };
  });
  if (items.length) document.dispatchEvent(new CustomEvent('lla:venues', { detail: items }));
}).catch(() => {});
