/* How much atmosphere this device gets, and the governor that takes it back.
 *
 *   0 — nothing. The page is exactly what it was before any of this existed.
 *   1 — hero, island water, seams. Scenes render one frame and hold.
 *   2 — adds the heavier optional work.
 *
 * The governor only ever demotes. Promoting back up after a recovery reads as
 * flickering, and a device that struggled once will struggle again. */
import { reduce, fine } from '../core.js';
import { refreshHz } from './ticker.js';

function probe() {
  if (reduce) return 0;
  let ok = false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { return 0; }
  if (!ok) return 0;

  const cores = navigator.hardwareConcurrency || 2;
  const mobile = navigator.userAgentData?.mobile ?? !fine.matches;
  const saveData = navigator.connection?.saveData === true;
  if (saveData || mobile || cores <= 4) return 1;
  return 2;
}

let tier = probe();
const listeners = [];

export const get = () => tier;
export const onChange = fn => listeners.push(fn);

/* Demotion order: the most expensive thing that is least load-bearing goes
 * first, so a struggling machine still gets the seams and the water. */
export function demote(why) {
  if (tier === 0) return;
  tier--;
  console.info(`[gl] stepping down to tier ${tier}${why ? ` (${why})` : ''}`);
  listeners.forEach(f => { try { f(tier); } catch {} });
}

/* Frame pacing, measured honestly.
 *
 * This used to wrap `performance.now()` around the GL calls, which measures
 * nothing useful: GL commands are queued asynchronously, so the number was
 * really the cost of the layout reads and driver validation that happened to
 * sit in the window. A scroll inflates exactly that — the nav handler dirties
 * style every frame — so the governor reliably punished capable machines for
 * scrolling, then "fixed" it by deleting effects.
 *
 * The frame interval is the honest signal. It includes everything on the
 * page, which is the point: if frames are long, shedding our work helps
 * whether or not we caused it. */
let ema = 0, bad = 0;
export function sample(dtMs) {
  /* Compare against the display's own cadence, not a hard 60Hz — 33ms is a
   * perfect frame on a 30Hz panel and a terrible one on a 120Hz panel. */
  const budget = Math.max(20, 1000 / refreshHz() * 1.7);
  ema = ema ? ema * 0.92 + dtMs * 0.08 : dtMs;
  if (ema > budget) { if (++bad >= 180) { bad = 0; ema = 0; demote('sustained frame interval'); } }
  else bad = Math.max(0, bad - 2);
}
export const cost = () => ema;

/* Reduced motion can be switched on mid-session; honour it immediately. */
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', e => {
  if (e.matches && tier > 0) { tier = 0; listeners.forEach(f => { try { f(0); } catch {} }); }
});
