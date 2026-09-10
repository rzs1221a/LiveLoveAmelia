/* Love. Live. Amelia. — core helpers (Seamark) */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = matchMedia('(pointer:fine) and (hover:hover)');
export const hasGsap = typeof gsap !== 'undefined';
if (hasGsap && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
export const fmtBrief = t => esc(t).replace(/^([A-Z][A-Z0-9 &']{3,})$/gm, '<b>$1</b>');
export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

/* Session id — groups a visitor's concierge turns, briefs and leads. */
export function sessionId() {
  try {
    let s = sessionStorage.getItem('lla:session');
    if (!s) {
      s = (crypto.randomUUID && crypto.randomUUID()) ||
        [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('lla:session', s);
    }
    return s;
  } catch { return ''; }
}
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  ses(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  sesSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};

/* Reveal-on-scroll for .rv.pre — safe for late-rendered nodes. */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px' });
export function reveal(els) {
  const list = els || $$('.rv.pre');
  list.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.remove('pre'); else io.observe(e); });
  setTimeout(() => list.forEach(e => e.classList.remove('pre')), 3000);
}

/* Shared button-group picker used by the match quiz and the seller stepper. */
export function optsGroup(root, picks, onPick) {
  $$('.opts', root).forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', g).forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    picks[g.dataset.key] = b.textContent.trim();
    onPick?.(g.dataset.key, picks[g.dataset.key]);
  }));
}

/* Animate a number into an element; instant when motion is off. */
export function countTo(el, value, format = fmt) {
  if (!hasGsap || reduce) { el.textContent = format(value); return; }
  const o = { v: parseFloat(String(el.dataset.v || 0)) || 0 };
  gsap.killTweensOf(o);
  gsap.to(o, { v: value, duration: .6, ease: 'power3.out', onUpdate: () => { el.textContent = format(o.v); el.dataset.v = o.v; } });
  el.dataset.v = value;
}
