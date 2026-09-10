/* A tideline where two sections meet.
 *
 * The colours are read off the neighbours at runtime rather than hard-coded,
 * which is what lets the island section invert with the colour scheme without
 * a special case — two of the six seams simply run the other way. */
import { $, $$ } from '../../core.js';
import { NOISE, OUT } from '../glsl.js';
import { register } from '../sched.js';

/* Computed backgroundColor is always a resolved colour. Reading the design
 * token instead would hand back the literal string "var(--sand)", because an
 * unregistered custom property resolves as authored, not as a value.
 *
 * The catch, found by looking at the result: most sections here declare no
 * background at all and inherit the page's, and those compute to
 * `rgba(0, 0, 0, 0)`. Taken at face value that is opaque black, which put a
 * hard black bar above the waterline on four of the six seams. So walk up
 * until something actually paints. */
function parse(str) {
  let m = String(str || '').match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(n => !Number.isNaN(n))) {
      return { rgb: [p[0] / 255, p[1] / 255, p[2] / 255], a: p.length > 3 ? p[3] : 1 };
    }
  }
  /* Chrome returns this form wherever color-mix() is involved. */
  m = String(str || '').match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

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
uniform float uT, uProg;

void main(){
  vec2 uv = (gl_FragCoord.xy - uRect.xy) / uSize;
  float y = uv.y;

  /* Which neighbour is the beach and which is the water is decided by
   * luminance, not by position. That is what makes this work at all six
   * seams and survive the island section inverting with the colour scheme —
   * two of them simply run upside down. */
  float lumA = dot(uAbove, vec3(0.299, 0.587, 0.114));
  float lumB = dot(uBelow, vec3(0.299, 0.587, 0.114));
  float sandUp = step(lumB, lumA);
  vec3 sand  = mix(uBelow, uAbove, sandUp);
  vec3 water = mix(uAbove, uBelow, sandUp);

  /* The waterline climbs as the seam rises through the viewport, so arriving
   * at it is the tide coming in rather than a loop that happens to be playing. */
  float edge   = mix(0.58, 0.43, uProg);
  float swell  = fbm(vec2(uv.x * 2.6 + uT * 0.05, uT * 0.08));
  float ripple = fbm(vec2(uv.x * 7.5 - uT * 0.09, 4.3));
  float line   = edge + (swell - 0.5) * 0.13 + (ripple - 0.5) * 0.045;

  /* Signed distance from the waterline, positive into the sand. */
  float d = (y - line) * (sandUp * 2.0 - 1.0);

  vec3 col = mix(water, sand, smoothstep(-0.02, 0.02, d));

  /* Wet sand — the strip the water has just left, still dark. It belongs on
   * the sand side; darkening the water side did nothing visible at all. */
  float wet = smoothstep(0.30, 0.0, d) * step(0.0, d);
  col = mix(col, mix(col, water, 0.45), wet);

  /* Foam: a scalloped edge with lace breaking off it, not a drawn line. */
  float scallop = fbm(vec2(uv.x * 13.0 + uT * 0.18, 9.1));
  float width   = 0.050 + 0.030 * scallop;
  float core    = smoothstep(width, 0.0, abs(d));
  float lace    = step(0.58, fbm(vec2(uv.x * 32.0 - uT * 0.38, d * 26.0 + uT * 0.2)));
  float foam    = clamp(max(core * 0.70, core * lace), 0.0, 1.0);
  col = mix(col, vec3(0.97, 0.98, 0.97), foam * 0.92);

  /* Feathered at both ends so the seam has no edges of its own — it has to
   * dissolve into the real section colours it sits between. */
  float a = smoothstep(0.0, 0.14, y) * smoothstep(1.0, 0.86, y);
  writePremul(col, a);
}`;

export function mountSeams(layer) {
  const seams = $$('.seam');
  if (!seams.length) return 0;
  const prog = layer.shader('seam', FRAG);
  if (!prog) return 0;

  const items = seams.map(el => ({
    el,
    above: $(el.dataset.above),
    below: $(el.dataset.below),
    a: [0, 0, 0], b: [0, 0, 0],
  }));

  /* Two neighbours can legitimately be the same colour — in dark mode the
   * testimonials and contact sections both resolve to the same marsh. There
   * is no boundary there to dramatise, and drawing one anyway would put a
   * foam line across flat ground, so those seams simply stand down. */
  function readColors() {
    for (const it of items) {
      it.a = rgb(it.above, it.a);
      it.b = rgb(it.below, it.b);
      const dist = Math.abs(it.a[0] - it.b[0]) + Math.abs(it.a[1] - it.b[1]) + Math.abs(it.a[2] - it.b[2]);
      it.active = dist > 0.05;
      it.el.dataset.seam = it.active ? 'active' : 'flat';
    }
  }
  readColors();

  /* Re-read on anything that can repaint the neighbours. */
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => setTimeout(readColors, 60));
  new MutationObserver(() => setTimeout(readColors, 60))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  for (const it of items) {
    register({
      el: it.el, layer, fps: 30, priority: 3, minTier: 1,
      draw(v, now) {
        if (!it.active) return;
        const r = v.rect;
        const prog01 = Math.min(1, Math.max(0, 1 - (r.top + r.height / 2) / innerHeight));
        layer.drawView(prog, r, (gl, p) => {
          gl.uniform3f(p.u('uAbove'), it.a[0], it.a[1], it.a[2]);
          gl.uniform3f(p.u('uBelow'), it.b[0], it.b[1], it.b[2]);
          gl.uniform1f(p.u('uT'), now);
          gl.uniform1f(p.u('uProg'), prog01);
        });
      },
    });
  }
  return items.length;
}
