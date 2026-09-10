/* The view scheduler: who draws, how often, and what gets dropped first.
 *
 * Three strict phases per tick. Reads never interleave with writes, so a
 * dozen live rect reads cost one style recalculation rather than a dozen
 * forced layouts. */
import * as ticker from './ticker.js';
import * as tier from './tier.js';

const views = [];
let layers = [];
let visibleCount = 0;
let ticking = false;

/* Warm views up slightly before they scroll into frame, so nothing pops. */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    const v = views.find(v => v.el === e.target);
    if (!v || v.visible === e.isIntersecting) return;
    v.visible = e.isIntersecting;
    visibleCount += e.isIntersecting ? 1 : -1;
  });
  sync();
}, { rootMargin: '20% 0px' });

export function addLayer(layer) { if (layer) layers.push(layer); }

/* fps must be a whole divisor of the real refresh rate or it beats against
 * it: 24 on a 60Hz panel alternates two- and three-frame holds, which reads
 * as cheap. 30, 20 and 15 divide cleanly on both 60 and 120. */
export function register(view) {
  const v = {
    fps: 30, priority: 5, minTier: 1, visible: false, rect: null,
    ...view,
    /* Spreading phases matters as much as the rate. Eight views all landing
     * on the same tick gives one heavy frame and one empty one forever,
     * which feels worse than simply running everything at full rate. */
    phase: views.length * 7,
  };
  views.push(v);
  io.observe(v.el);
  return v;
}

export function unregister(el) {
  const i = views.findIndex(v => v.el === el);
  if (i < 0) return;
  if (views[i].visible) visibleCount--;
  io.unobserve(el);
  views.splice(i, 1);
  sync();
}

function sync() {
  const want = visibleCount > 0 && tier.get() > 0;
  if (want && !ticking) { ticking = true; ticker.add(tick); }
  else if (!want && ticking) { ticking = false; ticker.remove(tick); }
}

const BUDGET_MS = 8;

function tick(now, dt, frame) {
  const active = tier.get();
  if (active === 0) { sync(); return; }
  const t0 = performance.now();

  /* Phase A — reads only. */
  const due = [];
  for (const v of views) {
    if (!v.visible || v.minTier > active) continue;
    const stride = ticker.strideFor(v.fps);
    if ((frame + v.phase) % stride !== 0) continue;
    v.rect = v.el.getBoundingClientRect();
    if (v.rect.width > 0 && v.rect.height > 0) due.push(v);
  }
  if (!due.length) return;

  /* Phase B — writes only, GL exclusively. Grouped by layer so each one
   * clears once, and sorted by priority so an overrun sheds the least
   * important work rather than whatever happened to be last. */
  due.sort((a, b) => a.priority - b.priority);
  const started = new Set();
  for (const v of due) {
    if (performance.now() - t0 > BUDGET_MS && v.priority > 1) { v.skipped = (v.skipped || 0) + 1; continue; }
    if (!started.has(v.layer)) {
      if (!v.layer.beginFrame()) continue;
      started.add(v.layer);
    }
    try { v.draw(v, now, dt); } catch (e) { console.warn('[gl] view failed, dropping', e); unregister(v.el); }
  }

  /* Phase C — adapt. */
  tier.sample(performance.now() - t0);
}

tier.onChange(t => {
  sync();
  if (t === 0) { layers.forEach(l => l.dispose()); layers = []; views.length = 0; }
});

export const debug = () => ({ views: views.length, visible: visibleCount, ticking, tier: tier.get(), cost: tier.cost() });
