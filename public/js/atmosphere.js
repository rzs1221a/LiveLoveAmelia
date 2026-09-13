/* Mounts the atmosphere: the seam shorelines and the island water.
 *
 * Nothing here is load-bearing. If the tier probe says no, or a context or a
 * shader fails, the page is exactly what it was before any of this existed. */
import { reduce } from './core.js';
import * as tier from './gl/tier.js';
import { mountSeams } from './gl/views/seam.js';
import { mountWater } from './gl/views/water.js';
import { mountScenes } from './gl/views/scene.js';

if (!reduce && tier.get() > 0) {
  /* Each seam owns a small canvas inside its own element rather than sharing
   * one fixed full-viewport canvas. A fixed canvas sat underneath the nav's
   * backdrop blur and the grain's blend layer, so every frame it painted cost
   * a full-viewport re-composite — and being fixed, it had to chase its host
   * elements during a scroll and always lagged them. Hosted canvases scroll
   * with the page, so they cannot drift, and they leave the compositor alone. */
  mountSeams();
  mountWater();
  /* Static, so they cost no live context at all — one transient context draws
   * all eleven and is released immediately. */
  mountScenes();
}
