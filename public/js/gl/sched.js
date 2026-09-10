/* The view scheduler: who draws, how often, and what gets dropped first.
 *
 * Reads never interleave with writes, so a batch of live rect reads costs one
 * style recalculation rather than a forced layout each. */
import * as ticker from './ticker.js';
import * as tier from './tier.js';

const views = [];
let layers = [];
let visibleCount = 0;
let ticking = false;
let phaseSeed = 0;

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

export function register(view) {
  const v = {
    fps: 30, priority: 5, minTier: 1, visible: false, rect: null,
    ...view,
    /* Spreading phases matters as much as the rate: several views landing on
     * the same tick gives one heavy frame and one empty one. Seeded from a
     * counter rather than the array length, so unregistering a view cannot
     * make the next one collide with an existing phase. */
    phase: (phaseSeed += 7),
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

function tick(now, dt, frame) {
  const active = tier.get();
  if (active === 0) { sync(); return; }

  /* Phase A — reads only. */
  const due = [];
  for (const v of views) {
    if (!v.visible || v.minTier > active) continue;
    if ((frame + v.phase) % ticker.strideFor(v.fps) !== 0) continue;
    v.rect = v.el.getBoundingClientRect();
    if (v.rect.width > 0 && v.rect.height > 0) due.push(v);
  }

  /* Phase B — writes only. Each view owns its own canvas and clears just
   * that canvas, so a view that is not due this frame simply holds its last
   * image instead of being wiped by a neighbour that was. */
  due.sort((a, b) => a.priority - b.priority);
  for (const v of due) {
    try { v.draw(v, now, dt); } catch (e) { console.warn('[gl] view failed, dropping', e); unregister(v.el); }
  }

  /* Phase C — adapt on the real frame interval. */
  if (due.length) tier.sample(dt);
}

tier.onChange(t => {
  sync();
  if (t === 0) { layers.forEach(l => l.dispose()); layers = []; views.length = 0; }
});

export const debug = () => ({ views: views.length, visible: visibleCount, ticking, tier: tier.get(), cost: tier.cost() });
