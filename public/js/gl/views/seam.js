/* A tideline where two sections meet.
 *
 * Each seam owns a small canvas inside its own element. The first version
 * shared one fixed full-viewport canvas, which was wrong three ways: the
 * shared canvas was cleared every frame but its views drew on interleaved
 * phases, so they strobed; being fixed, each view had to be re-placed from a
 * fresh rect every frame and always lagged the element it was welded to; and
 * a full-viewport canvas repainting under the nav's backdrop blur and the
 * grain's blend layer forced a whole-page re-composite each time.
 *
 * A canvas inside the seam scrolls with the seam. It cannot drift, nothing
 * else can clear it, and the compositor only sees a small dirty rect. */
import { $, $$ } from '../../core.js';
import { NOISE, OUT } from '../glsl.js';
import { createLayer } from '../layer.js';
import { register, addLayer } from '../sched.js';

/* Computed backgroundColor is always a resolved colour. Reading the design
 * token instead would hand back the literal string "var(--sand)", because an
 * unregistered custom property resolves as authored, not as a value. */
function parse(str) {
  let m = String(str || '').match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(n => !Number.isNaN(n))) {
      return { rgb: [p[0] / 255, p[1] / 255, p[2] / 255], a: p.length > 3 ? p[3] : 1 };
    }
  }
  m = String(str || '').match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

/* Most sections here declare no background and inherit the page's, and those
 * compute to rgba(0,0,0,0). Taken at face value that is opaque black, which
 * put a hard black bar above the waterline. Walk up until something paints. */
function rgb(el, fallback) {
  for (let n = el; n && n !== document.documentElement.parentNode; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0.02) return c.rgb;
  }
  const root = parse(getComputedStyle(document.documentElement).backgroundColor);
  return root && root.a > 0.02 ? root.rgb : fallback;
}

const FRAG = NOISE + OUT + `
uniform vec4 uRect; uniform vec2 uSize;
uniform vec3 uAbove, uBelow;
uniform float uT;

void main(){
  vec2 uv = (gl_FragCoord.xy - uRect.xy) / uSize;
  float y = uv.y;

  /* Which neighbour is beach and which is water is decided by luminance, not
   * by position. That is what makes this work at every seam and survive the
   * island section inverting with the colour scheme, where it runs upside down. */
  float lumA = dot(uAbove, vec3(0.299, 0.587, 0.114));
  float lumB = dot(uBelow, vec3(0.299, 0.587, 0.114));
  float sandUp = step(lumB, lumA);
  vec3 sand  = mix(uBelow, uAbove, sandUp);
  vec3 water = mix(uAbove, uBelow, sandUp);

  /* The waterline breathes on its own clock. Driving it from scroll position
   * walked the apparent section boundary fifteen pixels up the seam as you
   * scrolled past, which read as the page coming apart. */
  float edge   = 0.50 + 0.045 * sin(uT * 0.19);
  float swell  = fbm3(vec2(uv.x * 2.6, uT * 0.07));
  float ripple = fbm3(vec2(uv.x * 7.5 - uT * 0.09, 4.3));
  float line   = edge + (swell - 0.5) * 0.10 + (ripple - 0.5) * 0.035;

  float d = (y - line) * (sandUp * 2.0 - 1.0);
  vec3 col = mix(water, sand, smoothstep(-0.02, 0.02, d));

  /* Wet sand — the strip the water has just left, still dark. */
  float wet = smoothstep(0.30, 0.0, d) * step(0.0, d);
  col = mix(col, mix(col, water, 0.45), wet);

  float scallop = fbm3(vec2(uv.x * 13.0 + uT * 0.16, 9.1));
  float width   = 0.050 + 0.030 * scallop;
  float core    = smoothstep(width, 0.0, abs(d));
  float lace    = step(0.58, fbm3(vec2(uv.x * 32.0 - uT * 0.34, d * 26.0 + uT * 0.18)));
  float foam    = clamp(max(core * 0.70, core * lace), 0.0, 1.0);
  col = mix(col, vec3(0.97, 0.98, 0.97), foam * 0.92);

  /* Feathered at both ends so the seam has no edges of its own. */
  float a = smoothstep(0.0, 0.14, y) * smoothstep(1.0, 0.86, y);
  writePremul(col, a);
}`;

export function mountSeams() {
  const seams = $$('.seam');
  if (!seams.length) return 0;

  const items = seams.map(el => ({
    el, above: $(el.dataset.above), below: $(el.dataset.below),
    a: [0, 0, 0], b: [0, 0, 0], active: false, layer: null, prog: null, built: false,
  }));

  function readColors() {
    for (const it of items) {
      it.a = rgb(it.above, it.a);
      it.b = rgb(it.below, it.b);
      /* Two neighbours can legitimately be the same colour — in dark mode the
       * testimonials and contact sections both resolve to the same marsh.
       * There is no boundary there to dramatise. */
      const dist = Math.abs(it.a[0] - it.b[0]) + Math.abs(it.a[1] - it.b[1]) + Math.abs(it.a[2] - it.b[2]);
      it.active = dist > 0.05;
      it.el.dataset.seam = it.active ? 'active' : 'flat';
    }
  }
  readColors();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => setTimeout(readColors, 60));
  new MutationObserver(() => setTimeout(readColors, 60))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  /* Contexts are made on first approach, so a visitor who never scrolls past
   * the hero pays for none of them. */
  function build(it) {
    it.built = true;
    if (!it.active) return false;
    it.layer = createLayer(`fx-seam-${items.indexOf(it)}`, { dpr: 1, host: it.el });
    if (!it.layer) return false;
    it.prog = it.layer.shader('seam', FRAG);
    if (!it.prog) { it.layer.dispose(); it.layer = null; return false; }
    addLayer(it.layer);
    return true;
  }

  let n = 0;
  for (const it of items) {
    register({
      el: it.el, fps: 30, priority: 3, minTier: 1,
      draw(v, now) {
        if (!it.built && !build(it)) return;
        if (!it.layer) return;
        it.layer.beginFrame();
        it.layer.drawView(it.prog, v.rect, (gl, p) => {
          gl.uniform3f(p.u('uAbove'), it.a[0], it.a[1], it.a[2]);
          gl.uniform3f(p.u('uBelow'), it.b[0], it.b[1], it.b[2]);
          gl.uniform1f(p.u('uT'), now);
        });
      },
    });
    n++;
  }
  return n;
}
