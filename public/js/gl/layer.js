/* One fixed canvas, many views, drawn with scissor rectangles.
 *
 * The alternative — a small canvas per effect — needs a context each, and a
 * page like this wants roughly twenty. Browsers force-lose the oldest well
 * before that, so the failure is intermittent black rectangles rather than a
 * clean error. Rendering every view into one full-viewport canvas, scissored
 * to each host element's live screen rect, costs one context total. */
import { context, program, drawQuad } from './program.js';

/* Above section backgrounds and content, below the nav, the drawer, the
 * command palette and the grain. Everything drawn here is low-alpha and
 * additive, the same bargain the film grain already makes. */
export const Z = 40;

/* `host` attaches the canvas inside an element instead of pinning it to the
 * viewport, for views that must sit behind page content rather than over it.
 * The island water needs that: it belongs under the map's SVG. */
export function createLayer(id, { dpr = 1, host = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = host
    ? 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0'
    : `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${Z}`;
  (host || document.body).appendChild(canvas);

  const ctx = context(canvas, { alpha: true, premultipliedAlpha: true });
  if (!ctx) { canvas.remove(); return null; }
  let { gl } = ctx;
  let lost = false;

  gl.enable(gl.BLEND);
  /* Premultiplied source. Straight alpha here rings every soft edge with a
   * dark halo, and foam and caustics are made of nothing else. */
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const scale = Math.min(devicePixelRatio || 1, dpr);
  let W = 0, H = 0, pending = 0;
  function size() {
    const cw = host ? canvas.clientWidth : innerWidth, ch = host ? canvas.clientHeight : innerHeight;
    const w = Math.max(1, Math.round(cw * scale)), h = Math.max(1, Math.round(ch * scale));
    if (w === W && h === H) return;
    W = canvas.width = w; H = canvas.height = h;
  }
  const resize = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(size); };
  size();
  addEventListener('resize', resize, { passive: true });
  if (host) new ResizeObserver(resize).observe(canvas);

  const programs = new Map();
  ctx.onLost(() => { lost = true; });
  ctx.onRestored(() => {
    gl = ctx.gl; programs.clear(); lost = false;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    W = H = 0; size();
  });

  return {
    get gl() { return gl; },
    get lost() { return lost; },
    get scale() { return scale; },
    canvas,

    /* Programs are cached per layer so a dozen seams share one compile. */
    shader(key, frag) {
      if (!programs.has(key)) programs.set(key, program(gl, frag, undefined, key));
      return programs.get(key);
    },

    beginFrame() {
      if (lost) return false;
      size();
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      return true;
    },

    /* rect is a live getBoundingClientRect in CSS pixels; GL's origin is at
     * the bottom, hence the flip. A hosted layer measures against its own
     * canvas rather than the viewport. */
    drawView(prog, rect, setUniforms) {
      if (lost || !prog) return;
      const base = host ? canvas.getBoundingClientRect() : { left: 0, top: 0, height: innerHeight };
      const x = Math.round((rect.left - base.left) * scale);
      const y = Math.round((base.top + base.height - rect.top - rect.height) * scale);
      const w = Math.round(rect.width * scale), h = Math.round(rect.height * scale);
      if (w <= 0 || h <= 0 || y + h < 0 || y > H) return;
      gl.viewport(x, y, w, h);
      gl.scissor(x, y, w, h);
      prog.use();
      gl.uniform4f(prog.u('uRect'), x, y, w, h);
      gl.uniform2f(prog.u('uSize'), w, h);
      setUniforms?.(gl, prog);
      drawQuad(gl, prog);
    },

    dispose() { ctx.dispose(); canvas.remove(); },
  };
}
