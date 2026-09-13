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

/* PRE-LAUNCH: unlock the paid endpoints for a demo browser. Visit the page
 * once with ?demo=amelia-preview-2026 and it sticks. Remove with the gate. */
try {
  const k = new URLSearchParams(location.search).get('demo');
  if (k) { localStorage.setItem('lla:demo', k); history.replaceState(null, '', location.pathname); }
} catch {}
export const demoHeaders = () => { const k = store.get('lla:demo'); return k ? { 'x-demo': k } : {}; };

/* First-party events for the owner page. Beacon-shaped: never awaited,
 * never allowed to fail anything. */
export function track(ev, data = {}) {
  try {
    const body = JSON.stringify({ ev, session: sessionId(), path: location.pathname, ...data });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {}
}
/* Mirror a captured lead into the owner's inbox. Forms still emails Kelly. */
export async function sendLead(lead) {
  try {
    const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json', ...demoHeaders() },
      body: JSON.stringify({ ...lead, session: sessionId(), page: location.href }) });
    return r.ok;
  } catch { return false; }
}
if (!location.pathname.startsWith('/kelly') && !location.pathname.startsWith('/brain')) track('view');

/* Split a reply from its trailing §§ follow-up chips. Pure, so the owner
 * pages can import it without dragging the live chat's DOM along. */
export function splitChips(text) {
  const i = text.lastIndexOf('§§');
  if (i < 0) return { body: text, chips: [] };
  let chips = []; try { chips = JSON.parse(text.slice(i + 2).trim()); } catch { chips = []; }
  return { body: text.slice(0, i).trimEnd(), chips: Array.isArray(chips) ? chips.slice(0, 3).map(String) : [] };
}
