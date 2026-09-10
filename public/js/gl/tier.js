/* How much atmosphere this device gets, and the governor that takes it back.
 *
 *   0 — nothing. The page is exactly what it was before any of this existed.
 *   1 — hero, island water, seams. Scenes render one frame and hold.
 *   2 — everything, including caustics and the fluid sim.
 *
 * The governor only ever demotes. Promoting back up after a recovery reads as
 * flickering, and a device that struggled once will struggle again. */
import { reduce, fine } from '../core.js';

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
 * first. Someone who cannot run the fluid sim should still get the seams. */
export function demote(why) {
  if (tier === 0) return;
  tier--;
  console.info(`[gl] stepping down to tier ${tier}${why ? ` (${why})` : ''}`);
  listeners.forEach(f => { try { f(tier); } catch {} });
}

/* Rolling frame cost. One sustained bad stretch demotes; brief spikes from a
 * layout or a GC pause do not. */
let ema = 0, bad = 0;
export function sample(costMs) {
  ema = ema ? ema * 0.9 + costMs * 0.1 : costMs;
  if (ema > 10) { if (++bad >= 60) { bad = 0; ema = 0; demote('sustained frame cost'); } }
  else bad = 0;
}
export const cost = () => ema;

/* Reduced motion can be switched on mid-session; honour it immediately. */
matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', e => {
  if (e.matches && tier > 0) { tier = 0; listeners.forEach(f => { try { f(0); } catch {} }); }
});
