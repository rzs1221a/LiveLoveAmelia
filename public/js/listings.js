/* Listing cards (placeholder art until the MLS feed lands). */
import { $, reduce, fmt, reveal } from './core.js';
import { LISTINGS } from './data.js';

(function () {
  const grid = $('#listingGrid'); if (!grid) return;
  const arts = ['<path d="M0 60 L60 20 L120 60 L120 100 L0 100Z"/><path d="M130 60 L200 30 L270 60 L270 100 L130 100Z"/>', '<path d="M20 100 L20 30 L280 30 L280 100Z"/><path d="M60 100 L60 55 L120 55 L120 100 M180 100 L180 55 L240 55 L240 100"/>', '<path d="M0 90 C60 70 100 95 150 80 S250 65 300 85 L300 100 L0 100Z"/><circle cx="240" cy="30" r="14"/>'];
  const made = [];
  LISTINGS.forEach((l, i) => {
    const el = document.createElement('article'); el.className = 'card rv pre';
    el.innerHTML = `<div class="ph"><div class="sky"></div><svg viewBox="0 0 300 100" preserveAspectRatio="none" fill="none" stroke="#F3F0EA" stroke-width="1">${arts[i % 3]}</svg><span class="pill">${l.tag}</span><button type="button" class="ask" data-ask="I'm looking at a ${l.bd}-bed, ${l.ba}-bath ${l.type.toLowerCase()} in ${l.area}, ${l.sf.toLocaleString()} sq ft, listed at ${fmt(l.price)}. What should I know, and what questions should I ask Kelly?">Ask about this home ✦</button></div><div class="b"><div class="price">${fmt(l.price)}</div><div class="addr">${l.type} · ${l.area}, FL 32034</div><div class="specs"><span><b>${l.bd}</b> bd</span><span><b>${l.ba}</b> ba</span><span><b>${l.sf.toLocaleString()}</b> sq ft</span></div></div>`;
    grid.appendChild(el); made.push(el);
    el.addEventListener('pointermove', e => { if (reduce) return; const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `translateY(-4px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg)`; });
    el.addEventListener('pointerleave', () => el.style.transform = '');
  });
  reveal(made);
})();
