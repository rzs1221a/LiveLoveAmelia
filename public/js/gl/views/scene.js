/* Real scenes behind the community portals and the listing cards, in place
 * of the flat line art standing in for photography.
 *
 * These never animate, so they need no live context: one transient context
 * draws all eleven at load and is then thrown away. Each host receives its
 * frame through `bitmaprenderer`, which is an ownership transfer rather than
 * a copy, and sidesteps the question of whether a small 2D canvas happens to
 * be hardware-accelerated. */
import { $$ } from '../../core.js';
import { context, program, drawQuad } from '../program.js';
import { NOISE } from '../glsl.js';

const FRAG = NOISE + `
uniform vec2 uSize; uniform float uSeed, uKind;

/* One horizon line per layer, pushed around by noise. */
float ridge(float x, float y, float base, float amp, float freq, float sd){
  return step(y, base + (fbm(vec2(x * freq + sd, sd * 3.1)) - 0.5) * amp);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uSize;
  float sd = uSeed;
  float k = uKind;
  /* Composition varies with the seed too. Shifting only the noise left every
   * ocean card with its horizon and its light in the same place, which read
   * as one image repeated. */
  float hz = 0.30 + h21(vec2(sd, 1.0)) * 0.16;
  float sx = 0.20 + h21(vec2(sd, 7.0)) * 0.60;

  /* Sky: deep at the top, opening up toward the horizon. */
  vec3 top = vec3(0.055, 0.106, 0.157);
  vec3 low = vec3(0.239, 0.318, 0.400);
  if (k > 2.5) { top = vec3(0.071, 0.122, 0.145); low = vec3(0.298, 0.376, 0.376); }   /* oak, town */
  if (k > 1.5 && k < 2.5) { top = vec3(0.047, 0.106, 0.169); low = vec3(0.400, 0.463, 0.482); } /* ocean */
  vec3 col = mix(low, top, pow(uv.y, 0.62));

  /* A soft light source low in the sky — the same golden-hour logic as the
   * hero, so the set reads as one place at one time of day. */
  vec2 sunP = vec2(sx, hz + 0.10);
  float sun = exp(-pow(length((uv - sunP) * vec2(uSize.x / uSize.y, 1.0)) * 2.1, 2.0));
  col += vec3(0.62, 0.46, 0.31) * sun * 0.70;
  col += vec3(0.45, 0.36, 0.27) * exp(-pow(abs(uv.y - hz) * 5.0, 2.0)) * 0.35;

  /* Haze bands. */
  col += vec3(0.06, 0.08, 0.09) * smoothstep(0.45, 0.9, fbm(vec2(uv.x * 2.2 + sd, uv.y * 5.0))) * (1.0 - uv.y) * 0.7;

  vec3 far  = vec3(0.118, 0.180, 0.227);
  vec3 mid  = vec3(0.063, 0.110, 0.149);
  vec3 near = vec3(0.020, 0.043, 0.063);

  if (k < 0.5) {
    /* DUNE — low sand ridges with sea oats catching the light. */
    col = mix(col, far,  ridge(uv.x, uv.y, hz + 0.08, 0.10, 1.6, sd));
    col = mix(col, mid,  ridge(uv.x, uv.y, hz - 0.02, 0.14, 2.8, sd + 9.0));
    float oats = step(0.86, fbm(vec2(uv.x * 90.0 + sd, uv.y * 8.0)));
    col = mix(col, vec3(0.42, 0.50, 0.47), oats * step(uv.y, 0.34) * step(0.24, uv.y) * 0.5);
    col = mix(col, near, ridge(uv.x, uv.y, hz - 0.12, 0.09, 1.9, sd + 4.0));
  } else if (k < 1.5) {
    /* MARSH — flat water cut by winding creeks. */
    col = mix(col, far, ridge(uv.x, uv.y, hz + 0.04, 0.05, 3.4, sd));
    float w = step(uv.y, hz + 0.02);
    float creek = smoothstep(0.42, 0.5, fbm(vec2(uv.x * 3.0 + sd, uv.y * 9.0)));
    col = mix(col, mid, w);
    col = mix(col, vec3(0.114, 0.208, 0.216), w * creek * 0.8);
    float grass = step(0.80, fbm(vec2(uv.x * 120.0, uv.y * 30.0 + sd)));
    col = mix(col, vec3(0.20, 0.27, 0.24), grass * w * 0.35);
  } else if (k < 2.5) {
    /* OCEAN — a plain horizon and long swell. */
    float sea = step(uv.y, hz + 0.08);
    float swell = fbm(vec2(uv.x * 4.0 + sd, uv.y * 26.0));
    col = mix(col, mix(mid, far, swell), sea);
    float glint = exp(-pow(abs(uv.x - sunP.x) * 3.0, 2.0)) * step(uv.y, hz + 0.08) * (1.0 - uv.y * 1.4);
    col += vec3(0.72, 0.62, 0.48) * glint * 0.65 * smoothstep(0.35, 0.6, swell);
    col = mix(col, near, step(uv.y, 0.10));
  } else if (k < 3.5) {
    /* OAK — live oaks closing overhead, the way the canopy roads look. */
    col = mix(col, far, ridge(uv.x, uv.y, hz + 0.02, 0.07, 2.2, sd));
    float canopy = fbm(vec2(uv.x * 3.4 + sd, (1.0 - uv.y) * 4.2));
    col = mix(col, near, smoothstep(0.46, 0.62, canopy) * smoothstep(0.55, 0.95, uv.y));
    float moss = step(0.88, fbm(vec2(uv.x * 40.0 + sd, uv.y * 14.0)));
    col = mix(col, vec3(0.14, 0.20, 0.19), moss * smoothstep(0.6, 0.85, uv.y) * 0.5);
    col = mix(col, mid, ridge(uv.x, uv.y, 0.16, 0.05, 3.0, sd + 2.0));
  } else {
    /* TOWN — porch roofs and gables stepping along the street. */
    col = mix(col, far, ridge(uv.x, uv.y, hz - 0.02, 0.04, 2.0, sd));
    float x = uv.x * 7.0 + sd;
    float cell = floor(x);
    float h = 0.20 + h21(vec2(cell, 3.0)) * 0.17;
    float roof = h - abs(fract(x) - 0.5) * 0.16;
    col = mix(col, mid, step(uv.y, roof));
    float win = step(0.74, h21(vec2(floor(x * 3.0), floor(uv.y * 22.0))));
    col = mix(col, vec3(0.62, 0.53, 0.36), win * step(uv.y, roof - 0.045) * step(0.07, uv.y) * 0.55);
    col = mix(col, near, step(uv.y, 0.07));
  }

  /* Vignette, then premultiply — every soft edge here would otherwise ring. */
  col *= 0.82 + 0.18 * smoothstep(1.25, 0.3, length(uv - vec2(0.5, 0.45)));
  gl_FragColor = vec4(col, 1.0);
}`;

const KIND = { dune: 0, marsh: 1, ocean: 2, oak: 3, town: 4 };

/* Each portal gets the scene that matches the place it opens. */
const PORTAL_SCENES = ['oak', 'marsh', 'town', 'ocean', 'dune'];
const LISTING_SCENES = ['ocean', 'dune', 'marsh'];

function paint(host, bmp) {
  const cv = document.createElement('canvas');
  cv.className = 'genart';
  cv.width = host.w; cv.height = host.h;
  cv.setAttribute('aria-hidden', 'true');
  const br = cv.getContext('bitmaprenderer');
  if (br) br.transferFromImageBitmap(bmp);
  else {
    /* One-time draw, so a plain 2D copy costs nothing that matters here. */
    const c2 = cv.getContext('2d');
    if (!c2) return false;
    c2.drawImage(bmp, 0, 0);
  }
  host.el.prepend(cv);
  host.el.classList.add('has-genart');
  return true;
}

export async function mountScenes() {
  const portals = $$('.port .art');
  const listings = $$('.card .ph');
  const hosts = [
    ...portals.map((el, i) => ({ el, kind: PORTAL_SCENES[i % PORTAL_SCENES.length], seed: 3.0 + i * 41.7, w: 560, h: 600 })),
    ...listings.map((el, i) => ({ el, kind: LISTING_SCENES[i % LISTING_SCENES.length], seed: 211.0 + i * 57.3, w: 480, h: 360 })),
  ];
  if (!hosts.length) return 0;

  /* One context for all eleven, released the moment they are drawn. */
  const off = document.createElement('canvas');
  const ctx = context(off, { alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!ctx) return 0;
  const gl = ctx.gl;
  const prog = program(gl, FRAG, undefined, 'generative scene');
  if (!prog) { ctx.dispose(); return 0; }

  let painted = 0;
  try {
    for (const host of hosts) {
      off.width = host.w; off.height = host.h;
      gl.viewport(0, 0, host.w, host.h);
      prog.use();
      gl.uniform2f(prog.u('uSize'), host.w, host.h);
      gl.uniform1f(prog.u('uSeed'), host.seed);
      gl.uniform1f(prog.u('uKind'), KIND[host.kind] ?? 0);
      drawQuad(gl, prog);
      const bmp = await createImageBitmap(off);
      if (paint(host, bmp)) painted++;
    }
  } catch (e) {
    console.warn('[gl] scene generation stopped', e);
  } finally {
    ctx.dispose();
  }
  return painted;
}
