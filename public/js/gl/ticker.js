/* The page's single frame loop.
 *
 * Everything animated hangs off this. Two reasons it exists: three independent
 * rAF loops were running before, and GSAP's ticker hands us a delta-time that
 * is already clamped after a stall, which is exactly what a shader clock and a
 * fluid sim both need.
 *
 * The GSAP and no-GSAP paths call back with an identical (timeSec, deltaMs,
 * frame) signature, so nothing downstream has to know which one is live. */
import { hasGsap } from '../core.js';

let cbs = [];
let clock = 0;      /* seconds, accumulated from clamped deltas — the one clock */
let frame = 0;
let raf = 0, last = 0, running = false;

/* Never let one stall teleport the clock. GSAP clamps at 33ms by default and
 * we match it, so a tab switch resumes instead of jumping. */
const MAX_DT = 33;

function step(dtMs) {
  dtMs = dtMs > MAX_DT ? MAX_DT : dtMs;
  clock += dtMs / 1000;
  frame++;
  measure(dtMs);
  /* Copy: a callback may remove itself mid-tick. */
  for (const fn of cbs.slice()) {
    try { fn(clock, dtMs, frame); } catch (e) { console.warn('[ticker] callback failed, dropping', e); remove(fn); }
  }
}

const pump = (_t, dt) => step(dt);
function loop(t) { raf = requestAnimationFrame(loop); step(last ? t - last : 16); last = t; }

function start() {
  if (running) return;
  running = true;
  if (hasGsap) gsap.ticker.add(pump);
  else { last = 0; raf = requestAnimationFrame(loop); }
}
/* Stopping matters more than it looks. GSAP sleeps its rAF when nothing needs
 * it; a callback that stays registered and early-returns keeps that rAF alive
 * for the whole session, burning battery with nothing to show for it. */
function stop() {
  if (!running) return;
  running = false;
  if (hasGsap) gsap.ticker.remove(pump);
  else cancelAnimationFrame(raf);
}

export function add(fn) { if (!cbs.includes(fn)) { cbs.push(fn); start(); } }
export function remove(fn) { cbs = cbs.filter(f => f !== fn); if (!cbs.length) stop(); }
export const time = () => clock;

/* Measured refresh rate, so per-view rates can be whole divisors of the real
 * panel instead of beating against it. */
let hz = 60, samples = [], settled = false, warmup = 0;
function measure(dt) {
  if (settled || dt <= 0) return;
  /* Skip the first stretch outright. Sampling from frame one measured the
   * load — hydration, the font swap, the intro timeline — and latched a
   * refresh rate as low as 30Hz forever, which then doubled every view's
   * stride on exactly the machines that could least afford it. */
  if (++warmup < 90) return;
  samples.push(dt);
  if (samples.length < 40) return;
  const sorted = samples.slice().sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  if (median > 0) hz = Math.min(240, Math.max(24, Math.round(1000 / median)));
  settled = true; samples = [];
}
export const refreshHz = () => hz;
/* A whole-number stride, so 30fps on a 120Hz panel is every 4th frame and on
 * 60Hz every 2nd — even spacing either way. */
export const strideFor = fps => Math.max(1, Math.round(hz / fps));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else if (cbs.length) { last = 0; start(); }
});
