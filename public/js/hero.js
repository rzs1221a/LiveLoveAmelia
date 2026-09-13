/* Hero: the sea, under the real sky over Amelia Island, plus the intro. */
import { $, $$, reduce, hasGsap } from './core.js';
import { loaderDone } from './preloader.js';
import * as ticker from './gl/ticker.js';
import { context, program, drawQuad } from './gl/program.js';
import { NOISE } from './gl/glsl.js';
import { almanac, project, AMELIA_LAT } from './gl/sun.js';
import * as tier from './gl/tier.js';

/* ---------- Sea and sky ---------- */
(function sea() {
  const c = $('#sea');
  if (!c || reduce || tier.get() === 0) return;
  const ctx = context(c, { alpha: false, premultipliedAlpha: false });
  if (!ctx) return;
  let { gl } = ctx;

  const frag = NOISE + `
  uniform vec2 r; uniform float t; uniform vec2 m;
  uniform vec3 uSun;    /* screen x, screen y, in-frame falloff */
  uniform float uSunAlt;
  uniform vec4 uMoon;   /* screen x, screen y, in-frame, illuminated fraction */
  uniform float uMoonAlt;
  uniform float uSid;   /* sidereal drift for the star field */

  /* The palette is the whole effect. The disc is a detail; the light is the
   * point, so every band below is a full sky, not a tint on one. */
  vec3 zenith(float a){
    vec3 c = vec3(0.015,0.028,0.060);
    c = mix(c, vec3(0.055,0.105,0.200), smoothstep(-18.,-6., a));
    c = mix(c, vec3(0.150,0.240,0.380), smoothstep(-6., 0.,  a));
    c = mix(c, vec3(0.230,0.410,0.600), smoothstep(0.,  7.,  a));
    c = mix(c, vec3(0.190,0.400,0.640), smoothstep(7.,  18., a));
    return c;
  }
  vec3 horizonCol(float a){
    vec3 c = vec3(0.030,0.048,0.085);
    c = mix(c, vec3(0.170,0.180,0.260), smoothstep(-18.,-6., a));
    c = mix(c, vec3(0.760,0.450,0.330), smoothstep(-6., 1.,  a));
    c = mix(c, vec3(0.960,0.740,0.500), smoothstep(1.,  8.,  a));
    c = mix(c, vec3(0.660,0.775,0.840), smoothstep(8.,  18., a));
    return c;
  }
  vec3 seaDeep(float a){
    vec3 c = vec3(0.008,0.016,0.032);
    c = mix(c, vec3(0.030,0.055,0.090), smoothstep(-18.,-4., a));
    c = mix(c, vec3(0.050,0.100,0.150), smoothstep(-4., 10., a));
    return c;
  }
  vec3 seaNear(float a){
    vec3 c = vec3(0.020,0.040,0.070);
    c = mix(c, vec3(0.090,0.150,0.190), smoothstep(-18.,-4., a));
    c = mix(c, vec3(0.150,0.290,0.360), smoothstep(-4., 10., a));
    return c;
  }

  /* Stars drift along the direction they actually rise at this latitude —
   * 59.3 degrees from horizontal looking east. Straight up reads as a
   * screensaver; this reads as the sky. */
  float starField(vec2 p){
    float ang = radians(59.3);
    vec2 q = p * 78.0 + vec2(cos(ang), sin(ang)) * uSid * 78.0;
    vec2 cell = floor(q);
    float id = h21(cell);
    if (id < 0.9955) return 0.0;
    vec2 f = fract(q) - 0.5;
    float tw = 0.65 + 0.35 * sin(t * 1.7 + id * 220.0);
    return smoothstep(0.34, 0.0, length(f)) * tw * (0.4 + 0.6 * fract(id * 71.3));
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / r;
    vec2 q = uv; q.x *= r.x / r.y;
    float aspect = r.x / r.y;
    float hor = 0.60 + 0.015 * sin(t * 0.05);
    float a = uSunAlt;
    /* A floor under the night. The true altitude at 10pm is around -45, where
     * every twilight term collapses to its base and the whole hero renders at
     * about #04070F — a black rectangle that reads as a failed page rather
     * than as evening. Palette lookups clamp to late dusk; stars and the moon
     * below still use the real altitude, so night still looks like night. */
    float pa = max(a, -4.0);

    vec3 zen = zenith(pa), hcol = horizonCol(pa);
    float night = smoothstep(0.0, -12.0, a);
    vec3 col;

    if (uv.y > hor) {
      float k = (uv.y - hor) / (1.0 - hor);
      col = mix(hcol, zen, pow(k, 0.55));

      col += vec3(0.9, 0.93, 1.0) * starField(vec2(uv.x * aspect, uv.y)) * night;

      /* Cloud band, lit from wherever the sun actually is. */
      float cl = fbm3(vec2(q.x * 1.6 + t * 0.012, uv.y * 3.0));
      float lit = mix(0.35, 1.0, smoothstep(-6.0, 8.0, pa));
      col += mix(vec3(0.10,0.12,0.13), vec3(0.30,0.20,0.16), smoothstep(6.0,-4.0,pa))
             * smoothstep(0.45, 0.8, cl) * (1.0 - k) * lit;

      /* The disc, only while it is genuinely in frame. */
      if (uSun.z > 0.001) {
        float d = length((uv - uSun.xy) * vec2(aspect, 1.0));
        col += vec3(1.0,0.94,0.84) * exp(-pow(d * 9.5, 2.0)) * 0.45 * uSun.z;
        col += vec3(1.0,0.72,0.45) * exp(-pow(d * 2.2, 2.0)) * 0.30 * uSun.z;
      }
      if (uMoon.z > 0.001 && uMoonAlt > -2.0) {
        vec2 md = (uv - uMoon.xy) * vec2(aspect, 1.0);
        float disc = smoothstep(0.030, 0.024, length(md));
        /* Phase: slide a shadow disc across, so a crescent is a crescent. */
        float shade = smoothstep(0.0, 0.010, length(md - vec2((1.0 - uMoon.w * 2.0) * 0.030, 0.0)) - 0.024 * 0.92);
        float lum = mix(disc * 0.10, disc, clamp(uMoon.w + shade, 0.0, 1.0));
        col += vec3(0.93,0.94,0.90) * lum * uMoon.z * night;
        col += vec3(0.55,0.62,0.72) * exp(-pow(length(md) * 7.0, 2.0)) * 0.16 * uMoon.z * night;
      }
    } else {
      float d = (hor - uv.y) / hor;
      float persp = 1.0 / (d * 6.0 + 0.06);
      vec2 w = vec2(q.x * persp * 1.4 + m.x * 0.15, persp * 2.2 + t * 0.22);
      float wv = fbm(w * 1.3) * 0.7 + fbm3(w * 3.1 + t * 0.05) * 0.3;
      float crest = smoothstep(0.62, 0.9, wv);
      col = mix(seaDeep(pa), seaNear(pa), d * 0.9 + wv * 0.25);

      /* A glint path only exists when something is up there to cast it. */
      float sunUp = smoothstep(-2.0, 4.0, a) * uSun.z;
      if (sunUp > 0.001) {
        float g = exp(-pow(abs(q.x - uSun.x * aspect) * (2.5 + d * 9.0), 2.0)) * (1.0 - d) * (0.5 + wv);
        col += mix(vec3(1.0,0.78,0.52), vec3(0.90,0.94,0.94), smoothstep(0.0,12.0,pa)) * g * 0.55 * pow(1.0 - d, 1.5) * sunUp;
      }
      float moonUp = smoothstep(-1.0, 6.0, uMoonAlt) * uMoon.z * night * uMoon.w;
      if (moonUp > 0.001) {
        float g = exp(-pow(abs(q.x - uMoon.x * aspect) * (3.5 + d * 11.0), 2.0)) * (1.0 - d) * (0.45 + wv);
        col += vec3(0.80,0.86,0.95) * g * 0.30 * pow(1.0 - d, 1.6) * moonUp;
      }
      col += vec3(0.8,0.88,0.9) * crest * 0.10 * (1.0 - d) * mix(0.35, 1.0, smoothstep(-8.0, 4.0, pa));
      col = mix(col, hcol * 0.9, pow(1.0 - d, 14.0) * 0.5);
    }

    float vig = smoothstep(1.2, 0.35, length(uv - vec2(0.5, 0.45)));
    col *= 0.85 + 0.15 * vig;
    gl_FragColor = vec4(col, 1.0);
  }`;

  let prog = program(gl, frag, undefined, 'hero sky');
  /* A failed compile used to leave a black rectangle that looked deliberate.
   * Drop the canvas instead and let the CSS marsh background stand. */
  if (!prog) { c.remove(); return; }
  prog.use();

  let mx = 0, my = 0, tx = 0, ty = 0, vis = true, lost = false, stopped = false;
  addEventListener('pointermove', e => {
    tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5;
  }, { passive: true });

  let pending = 0;
  function size() {
    /* 1.5x device pixels on a 1440-wide window is 2.9 megapixels of
     * five-octave noise, every frame. The waves carry no detail that fine. */
    const dpr = Math.min(devicePixelRatio, 1.0);
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

  /* The sky only needs recomputing on a human timescale. */
  let sky = null, skyAt = -1e9;
  function refreshSky(now) {
    if (now - skyAt < 60) return;
    skyAt = now;
    const a = almanac(new Date(), AMELIA_LAT);
    const s = project(a.sun.az, a.sun.alt), mo = project(a.moon.az, a.moon.alt);
    sky = { s, mo, sunAlt: a.sun.alt, moonAlt: a.moon.alt, illum: a.moon.illum };
  }

  let heroFrame = 0;
  function draw(now, dt) {
    if (!vis || lost || stopped) return;
    /* Half rate. The swell is slow enough that nobody can tell, and this is
     * the largest single draw on the page. */
    if (ticker.refreshHz() >= 50 && (++heroFrame & 1)) return;
    refreshSky(now);
    /* Frame-rate independent easing, so the parallax feels the same at 60 and 120. */
    const k = 1 - Math.pow(0.001, dt / 1000 * 0.6);
    mx += (tx - mx) * k; my += (ty - my) * k;
    prog.use();
    gl.uniform2f(prog.u('r'), c.width, c.height);
    gl.uniform1f(prog.u('t'), now);
    gl.uniform2f(prog.u('m'), mx, my);
    gl.uniform3f(prog.u('uSun'), sky.s.x, sky.s.y, sky.s.inFrame);
    gl.uniform1f(prog.u('uSunAlt'), sky.sunAlt);
    gl.uniform4f(prog.u('uMoon'), sky.mo.x, sky.mo.y, sky.mo.inFrame, sky.illum);
    gl.uniform1f(prog.u('uMoonAlt'), sky.moonAlt);
    gl.uniform1f(prog.u('uSid'), now * 0.0006);
    drawQuad(gl, prog);
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
  loaderDone.then(() => tl.play());
  gsap.to('#portrait', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
})();
