/* The island map, with water that moves.
 *
 * The SVG stays exactly as authored — it is the interaction surface, the
 * labels and the accessible content. This adds a canvas behind it and takes
 * the land shape from the SVG's own path data, so the artwork remains the
 * one source of truth: edit the map and the water follows. */
import { $, $$, reduce, hasGsap } from '../../core.js';
import { NOISE, OUT } from '../glsl.js';
import { createLayer } from '../layer.js';
import { register, addLayer } from '../sched.js';

const MASK_W = 200, MASK_H = 260;   /* half the 400x520 viewBox; plenty for a distance field */

/* Rasterise the land, then measure how far every water pixel is from it.
 * A real distance field costs one pass at load and buys the shoreline, the
 * shallows and the tide band for free. */
function landField(svg) {
  const paths = $$('.land, .main', svg).map(p => p.getAttribute('d')).filter(Boolean);
  if (!paths.length) return null;
  const c = document.createElement('canvas');
  c.width = MASK_W; c.height = MASK_H;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.fillStyle = '#000'; g.fillRect(0, 0, MASK_W, MASK_H);
  g.setTransform(MASK_W / 400, 0, 0, MASK_H / 520, 0, 0);
  g.fillStyle = '#fff';
  for (const d of paths) { try { g.fill(new Path2D(d)); } catch {} }
  g.setTransform(1, 0, 0, 1, 0, 0);

  const src = g.getImageData(0, 0, MASK_W, MASK_H).data;
  const N = MASK_W * MASK_H, BIG = 1e6;
  const dist = new Float32Array(N);
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) { land[i] = src[i * 4] > 127 ? 1 : 0; dist[i] = land[i] ? 0 : BIG; }

  /* Two-pass chamfer — cheap, and accurate enough that nobody could tell. */
  const at = (x, y) => y * MASK_W + x;
  for (let y = 0; y < MASK_H; y++) for (let x = 0; x < MASK_W; x++) {
    const i = at(x, y); let v = dist[i];
    if (x > 0) v = Math.min(v, dist[i - 1] + 1);
    if (y > 0) v = Math.min(v, dist[i - MASK_W] + 1);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - MASK_W - 1] + 1.414);
    if (x < MASK_W - 1 && y > 0) v = Math.min(v, dist[i - MASK_W + 1] + 1.414);
    dist[i] = v;
  }
  for (let y = MASK_H - 1; y >= 0; y--) for (let x = MASK_W - 1; x >= 0; x--) {
    const i = at(x, y); let v = dist[i];
    if (x < MASK_W - 1) v = Math.min(v, dist[i + 1] + 1);
    if (y < MASK_H - 1) v = Math.min(v, dist[i + MASK_W] + 1);
    if (x < MASK_W - 1 && y < MASK_H - 1) v = Math.min(v, dist[i + MASK_W + 1] + 1.414);
    if (x > 0 && y < MASK_H - 1) v = Math.min(v, dist[i + MASK_W - 1] + 1.414);
    dist[i] = v;
  }

  /* R: land flag. G: distance to shore, normalised over ~26px. */
  const tex = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    tex[i * 4] = land[i] ? 255 : 0;
    tex[i * 4 + 1] = Math.min(255, (dist[i] / 26) * 255);
    tex[i * 4 + 2] = 0; tex[i * 4 + 3] = 255;
  }
  return tex;
}

const FRAG = NOISE + OUT + `
uniform vec4 uRect; uniform vec2 uSize;
uniform sampler2D uLand;
uniform float uT, uTide;
uniform vec3 uWater, uShallow, uFoam;

void main(){
  vec2 uv = (gl_FragCoord.xy - uRect.xy) / uSize;
  vec2 tc = vec2(uv.x, 1.0 - uv.y);           /* the mask was drawn top-down */
  vec4 L = texture2D(uLand, tc);
  float isLand = L.r;
  float shore = L.g;                           /* 0 at the beach, 1 well offshore */

  if (isLand > 0.5) { gl_FragColor = vec4(0.0); return; }

  /* A slow drift south-east, the way the current actually sets past the
   * island, with a second finer layer over it. */
  vec2 flow = vec2(0.06, -0.10) * uT;
  float body = fbm(tc * 5.0 + flow);
  float fine = fbm(tc * 13.0 - flow * 1.7);

  vec3 col = mix(uShallow, uWater, smoothstep(0.0, 0.55, shore));
  col += (body - 0.5) * 0.035;

  /* Marsh channels: the shimmer belongs in the shallows and nowhere else. */
  float marsh = (1.0 - smoothstep(0.0, 0.42, shore)) * smoothstep(0.52, 0.88, fine);
  col = mix(col, uShallow * 1.5, marsh * 0.35);

  /* The tide breathes over the flats. */
  float band = smoothstep(0.16 + uTide * 0.10, 0.0, shore) * (1.0 - smoothstep(0.0, 0.03, shore));
  col = mix(col, uFoam, band * 0.14);

  /* Surf against the shore. This wants to be a suggestion: at full strength
   * it became a thick halo that swallowed the coastline the map is made of. */
  float surf = smoothstep(0.038, 0.0, shore) * (0.4 + 0.6 * smoothstep(0.45, 0.8, fine));
  col = mix(col, uFoam, surf * (0.16 + 0.10 * sin(uT * 0.6 + tc.y * 20.0)));

  float a = 0.55 * smoothstep(0.0, 0.015, shore);
  writePremul(col, a);
}`;

/* The beam and the boats are SVG animated by GSAP rather than shader work:
 * crisper at this size, far cheaper, and they can sit above the water and
 * below the labels, which is exactly where they belong. */
function addTraffic(svg) {
  if (!hasGsap || reduce) return;
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'map-traffic');
  g.setAttribute('aria-hidden', 'true');

  /* Amelia Island Light, at the north end. */
  const beam = document.createElementNS(NS, 'path');
  beam.setAttribute('class', 'beam');
  beam.setAttribute('d', 'M0 0 L165 -15 L165 15 Z');
  beam.setAttribute('transform', 'translate(178 92)');
  beam.setAttribute('filter', 'url(#beamSoft)');
  g.appendChild(beam);

  const lamp = document.createElementNS(NS, 'circle');
  lamp.setAttribute('class', 'lamp');
  lamp.setAttribute('cx', '178'); lamp.setAttribute('cy', '92'); lamp.setAttribute('r', '2.4');
  g.appendChild(lamp);

  /* Shrimp boats working the Amelia River, on the mainland side. */
  const boats = [
    { d: 'M96 150 C104 210 92 268 104 330 C112 386 100 430 108 470', dur: 54, delay: 0 },
    { d: 'M74 470 C86 420 72 366 84 306 C94 250 80 200 90 156', dur: 68, delay: 9 },
  ].map(b => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'wake'); path.setAttribute('d', b.d);
    g.appendChild(path);
    const boat = document.createElementNS(NS, 'path');
    boat.setAttribute('class', 'boat');
    boat.setAttribute('d', 'M-3.2 0 L3.2 0 L2.2 2.1 L-2.2 2.1 Z M0 0 L0 -3.4');
    g.appendChild(boat);
    return { ...b, path, boat };
  });

  svg.querySelector('g[clip-path]')?.appendChild(g) ?? svg.appendChild(g);

  gsap.to(beam, { rotation: 360, duration: 14, ease: 'none', repeat: -1, transformOrigin: '0px 0px', svgOrigin: '178 92' });
  gsap.to(lamp, { opacity: 0.35, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true });

  for (const b of boats) {
    const len = b.path.getTotalLength();
    const state = { p: 0 };
    gsap.to(state, {
      p: 1, duration: b.dur, delay: b.delay, ease: 'none', repeat: -1,
      onUpdate() {
        const pt = b.path.getPointAtLength(state.p * len);
        const ahead = b.path.getPointAtLength(Math.min(len, state.p * len + 2));
        const ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI + 90;
        b.boat.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang})`);
      },
    });
  }
}

export function mountWater() {
  const map = $('#map'), svg = map && $('svg', map);
  if (!map || !svg) return false;

  addTraffic(svg);

  const tex = landField(svg);
  if (!tex) return false;

  const layer = createLayer('fx-water', { dpr: 1.25, host: map });
  if (!layer) return false;
  const prog = layer.shader('island water', FRAG);
  if (!prog) { layer.dispose(); return false; }
  addLayer(layer);

  const gl = layer.gl;
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MASK_W, MASK_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  register({
    el: map, layer, fps: 30, priority: 2, minTier: 1,
    draw(v, now) {
      layer.drawView(prog, v.rect, (g2, p) => {
        g2.activeTexture(g2.TEXTURE0);
        g2.bindTexture(g2.TEXTURE_2D, t);
        g2.uniform1i(p.u('uLand'), 0);
        g2.uniform1f(p.u('uT'), now);
        /* A lazy tide, well slower than a real one — this is atmosphere,
         * not a tide table. */
        g2.uniform1f(p.u('uTide'), 0.5 + 0.5 * Math.sin(now * 0.045));
        g2.uniform3f(p.u('uWater'), 0.024, 0.075, 0.106);
        g2.uniform3f(p.u('uShallow'), 0.055, 0.145, 0.150);
        g2.uniform3f(p.u('uFoam'), 0.612, 0.761, 0.741);
      });
    },
  });
  return true;
}
