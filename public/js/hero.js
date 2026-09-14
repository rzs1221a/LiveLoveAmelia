/* Hero: the sea, under a daytime sky over Amelia Island, plus the intro.
 *
 * The sky holds a morning over the Atlantic every visit; the real sun and
 * moon used to put a black hero at a visitor's local midnight. */
import { $, $$, reduce, hasGsap } from './core.js';
import * as ticker from './gl/ticker.js';
import { context, program, drawQuad } from './gl/program.js';
import * as tier from './gl/tier.js';

/* The shader's sun, (0.30, 0.17, -0.94): ahead and to the right, about ten
 * degrees up. Low enough to lay ribbons of light across the water. */
const SUN_ALT = Math.asin(0.17 / Math.hypot(0.30, 0.17, 0.94)) * 180 / Math.PI;
let frames = 0;
/* For the smoke test: what sky this is, and whether it is actually drawing. */
export const debug = () => ({ sunAlt: SUN_ALT, frames });

/* ---------- Sea and sky ---------- */
(function sea() {
  const c = $('#sea');
  if (!c || reduce || tier.get() === 0) return;
  const ctx = context(c, { alpha: false, premultipliedAlpha: false });
  if (!ctx) return;
  let { gl } = ctx;

  /* Zander's sea. A ray from an eye 3.2 units up is refined against a sum of
   * seven wave trains, and the normal there reflects a sky with a low sun
   * ahead and to the right. Camera looks down -z. */
  const frag = `
  uniform vec2 resolution;
  uniform float time;

  const vec3 SUN = vec3(0.30, 0.17, -0.94);

  // Broad swells plus smaller waves traveling across them.
  float seaHeight(vec2 p) {
    float height = 0.0;
    float amplitude = 0.19;
    float frequency = 0.38;
    vec2 direction = normalize(vec2(0.85, 0.40));
    mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);

    for (int i = 0; i < 7; i++) {
      float phase = dot(p, direction) * frequency + time * sqrt(frequency) * 0.80;
      height += amplitude * (sin(phase) + 0.22 * sin(phase * 2.0 + 0.7));
      direction = turn * direction;
      frequency *= 1.86;
      amplitude *= 0.49;
    }
    return height;
  }

  vec3 sky(vec3 ray) {
    float elevation = max(ray.y, 0.0);
    vec3 horizon = vec3(0.76, 0.83, 0.81);
    vec3 upperSky = vec3(0.28, 0.48, 0.63);
    vec3 color = mix(horizon, upperSky, pow(clamp(elevation * 1.8, 0.0, 1.0), 0.55));
    float sunAlignment = max(dot(ray, normalize(SUN)), 0.0);
    // Broad atmospheric glow and a restrained sun disk.
    color += vec3(1.0, 0.77, 0.48) * pow(sunAlignment, 18.0) * 0.17;
    color += vec3(1.0, 0.88, 0.66) * pow(sunAlignment, 850.0) * 0.55;
    return color;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / resolution.y;
    vec3 camera = vec3(0.0, 3.2, 0.0);
    vec3 ray = normalize(vec3(uv.x, uv.y - 0.10, -1.5));
    vec3 color = sky(ray);

    if (ray.y < -0.001) {
      // Intersect the water, then refine against the wave surface.
      float distanceToWater = -camera.y / ray.y;
      for (int i = 0; i < 6; i++) {
        vec3 point = camera + ray * distanceToWater;
        float target = (seaHeight(point.xz) - camera.y) / ray.y;
        distanceToWater = mix(distanceToWater, target, 0.65);
      }
      vec3 point = camera + ray * distanceToWater;

      // Broader sampling at distance prevents noisy horizon shimmer.
      float epsilon = 0.035 + distanceToWater * 0.0015;
      float dx = seaHeight(point.xz + vec2(epsilon, 0.0)) - seaHeight(point.xz - vec2(epsilon, 0.0));
      float dz = seaHeight(point.xz + vec2(0.0, epsilon)) - seaHeight(point.xz - vec2(0.0, epsilon));
      vec3 normal = normalize(vec3(-dx, 2.0 * epsilon, -dz));
      vec3 view = -ray;
      vec3 reflected = reflect(ray, normal);

      float facing = max(dot(normal, view), 0.0);
      float fresnel = 0.025 + 0.975 * pow(1.0 - facing, 5.0);

      vec3 deepWater = vec3(0.025, 0.19, 0.25);
      vec3 tealWater = vec3(0.07, 0.36, 0.39);
      float swellLight = smoothstep(-0.25, 0.30, seaHeight(point.xz));
      vec3 water = mix(deepWater, tealWater, swellLight * 0.55);
      water *= 0.82 + 0.18 * max(dot(normal, normalize(SUN)), 0.0);

      color = mix(water, sky(reflected), fresnel);

      // Sunlight breaks into moving ribbons across the wave normals.
      vec3 halfway = normalize(normalize(SUN) + view);
      float specular = pow(max(dot(normal, halfway), 0.0), 180.0);
      color += vec3(1.0, 0.84, 0.60) * specular * 1.7;

      // Gentle crest highlights, kept subtle for a calm coastal feel.
      float crest = smoothstep(0.15, 0.32, seaHeight(point.xz));
      color += vec3(0.18, 0.34, 0.32) * crest * 0.08 * (1.0 - fresnel);

      // Blend distant water into the atmosphere.
      float haze = 1.0 - exp(-distanceToWater * 0.008);
      vec3 horizon = sky(normalize(vec3(ray.x, 0.0, ray.z)));
      color = mix(color, horizon, haze * 0.86);

      // Eliminate a hard seam where the ocean meets the sky.
      color = mix(sky(ray), color, smoothstep(0.001, 0.012, -ray.y));
    }

    // Subtle edge shading.
    vec2 screenUV = gl_FragCoord.xy / resolution;
    float edge = length((screenUV - 0.5) * vec2(0.8, 1.0));
    color *= 1.0 - 0.13 * smoothstep(0.25, 0.72, edge);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }`;

  let prog = program(gl, frag, undefined, 'hero sky');
  /* A failed compile used to leave a black rectangle that looked deliberate.
   * Drop the canvas instead and let the CSS marsh background stand. */
  if (!prog) { c.remove(); return; }
  prog.use();

  let vis = true, lost = false, stopped = false;

  let pending = 0;
  function size() {
    /* Cap the cost independently of screen density: at most 1.5x, at most
     * 1600 pixels wide, at most 1.2 megapixels. */
    const dpr = Math.min(devicePixelRatio || 1, 1.5, 1600 / Math.max(c.clientWidth, 1), Math.sqrt(1200000 / Math.max(c.clientWidth * c.clientHeight, 1)));
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width === w && c.height === h) return;      /* mobile URL-bar resize fires constantly */
    c.width = w; c.height = h; gl.viewport(0, 0, w, h);
  }
  const resize = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(size); };
  size();
  new ResizeObserver(resize).observe(c);

  const io = new IntersectionObserver(es => es.forEach(e => {
    vis = e.isIntersecting;
    if (vis) ticker.add(draw); else ticker.remove(draw);
  }));
  io.observe(c);

  ctx.onLost(() => { lost = true; ticker.remove(draw); });
  ctx.onRestored(() => {
    gl = ctx.gl; prog = program(gl, frag, undefined, 'hero sky');
    if (!prog) { c.remove(); return; }
    prog.use(); size(); lost = false; ticker.add(draw);
  });


  let heroFrame = 0;
  function draw(now, dt) {
    if (!vis || lost || stopped) return;
    /* Every frame on a 60Hz panel; every other frame on 120Hz and up, which
     * is still 60. Halving a 60Hz panel to 30 made the crests stutter. */
    if (ticker.refreshHz() >= 100 && (++heroFrame & 1)) return;
    prog.use();
    gl.uniform2f(prog.u('resolution'), c.width, c.height);
    gl.uniform1f(prog.u('time'), now);
    drawQuad(gl, prog);
    frames++;
  }
  ticker.add(draw);
  /* Stop drawing, but leave the canvas holding its last frame. Removing it
   * made the ocean vanish mid-session, which is a far louder failure than
   * the frame rate the governor was trying to protect. */
  tier.onChange(t => { if (t === 0) { stopped = true; ticker.remove(draw); } });
})();

/* ---------- Intro + parallax ---------- */
(function () {
  const lines = $$('.hero h1 .l span');
  if (!hasGsap || reduce) { lines.forEach(s => s.style.transform = 'none'); return; }
  const tl = gsap.timeline({ paused: true });
  tl.to(lines, { y: 0, duration: 1.1, stagger: .12, ease: 'power4.out' }, 0.1)
    .from('.hero .eyebrow, .hero .sub, .hero .cta', { opacity: 0, y: 18, duration: .8, stagger: .1, ease: 'power3.out' }, '-=.7')
    .from('#portrait', { opacity: 0, y: 40, duration: 1.2, ease: 'power3.out' }, '-=.9');
  tl.play();
  gsap.to('#portrait', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
})();
