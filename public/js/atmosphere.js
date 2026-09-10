/* Mounts the shared effect layer and everything drawn into it.
 *
 * Nothing here is load-bearing. If the tier probe says no, or a context or a
 * shader fails, the page is exactly what it was before any of this existed —
 * every effect sits on top of a static treatment that already works. */
import { reduce } from './core.js';
import * as tier from './gl/tier.js';
import { createLayer } from './gl/layer.js';
import { addLayer } from './gl/sched.js';
import { mountSeams } from './gl/views/seam.js';
import { mountWater } from './gl/views/water.js';

if (!reduce && tier.get() > 0) {
  /* Device pixel ratio 1 on purpose: foam and caustics are low-frequency, and
   * a 6k-wide framebuffer for a soft gradient is not a trade worth making. */
  const overlay = createLayer('fx-overlay', { dpr: 1 });
  if (overlay) {
    addLayer(overlay);
    mountSeams(overlay);
  }
  /* The water needs its own small context: it has to sit *behind* the map's
   * SVG, and the shared overlay is deliberately in front of page content. */
  mountWater();
}
