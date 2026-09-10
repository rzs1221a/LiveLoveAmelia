/* Love. Live. Amelia. — core helpers (Seamark) */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const motionMQ = matchMedia('(prefers-reduced-motion: reduce)');
/* Kept a boolean because every existing consumer reads it as one; `motionMQ`
 * is there for anything that needs to react to a mid-session change. */
export const reduce = motionMQ.matches;
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
  /* Safety net, deliberately scoped: clearing every `.pre` on the page after
   * three seconds would fire each reveal invisibly long before the visitor
   * scrolls to it, which is what used to happen. Rescue only what is close
   * enough to be at risk and leave the rest to the observer. */
  setTimeout(() => list.forEach(e => {
    if (e.getBoundingClientRect().top < innerHeight * 1.5) e.classList.remove('pre');
  }), 3000);
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
const counters = new WeakMap();
export function countTo(el, value, format = fmt) {
  if (!hasGsap || reduce) { el.textContent = format(value); counters.set(el, { v: value }); return; }
  /* The previous tween has to be killed by reference. Killing tweens of a
   * freshly-made object kills nothing, which left the affordability slider
   * spawning one tween per input event, all writing the same node — visible
   * as flickering digits that settled on the wrong number. */
  let s = counters.get(el);
  if (!s) counters.set(el, s = { v: 0, tween: null });
  s.tween?.kill();
  s.tween = gsap.to(s, { v: value, duration: .6, ease: 'power3.out', onUpdate: () => { el.textContent = format(s.v); } });
}
