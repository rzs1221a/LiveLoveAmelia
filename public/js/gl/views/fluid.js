/* A real fluid the cursor stirs, behind the concierge.
 *
 * Stam's method: advect, compute curl, confine vorticity, take the
 * divergence, solve for pressure with Jacobi, subtract the gradient. Every
 * parameter here is tuned down from the usual demo defaults, because this is
 * a background and not the subject.
 *
 * It is gated hard. #concierge holds a text input, and nobody should feel a
 * fluid simulation while they are typing a message to Kelly. */
import { $, reduce, fine } from '../../core.js';
import { context, program, drawQuad } from '../program.js';
import * as ticker from '../ticker.js';
import * as tier from '../tier.js';

const SIM = 128;    /* powers of two on purpose: half-float NPOT with linear */
const DYE = 256;    /* filtering fails outright on some mobile drivers */
const ITERATIONS = 16;
const DENSITY_DISSIPATION = 2.2;
const VELOCITY_DISSIPATION = 0.4;
const PRESSURE_RETAIN = 0.8;
const CURL = 20;
const SPLAT_RADIUS = 0.20;
const SPLAT_FORCE = 3200;

const VERT = `precision highp float;
attribute vec2 p; varying vec2 vUv, vL, vR, vT, vB; uniform vec2 texel;
void main(){ vUv = p*0.5+0.5;
  vL = vUv - vec2(texel.x,0.0); vR = vUv + vec2(texel.x,0.0);
  vT = vUv + vec2(0.0,texel.y); vB = vUv - vec2(0.0,texel.y);
  gl_Position = vec4(p,0.0,1.0); }`;

/* iOS Safari has shipped half-float textures while filtering them as nearest,
 * which turns advection into blocky mud. When linear is not real, sample it
 * by hand. */
const BILERP = `
vec4 bilerp(sampler2D s, vec2 uv, vec2 tsize){
  vec2 st = uv / tsize - 0.5;
  vec2 i = floor(st), f = fract(st);
  vec4 a = texture2D(s, (i + vec2(0.5,0.5)) * tsize);
  vec4 b = texture2D(s, (i + vec2(1.5,0.5)) * tsize);
  vec4 c = texture2D(s, (i + vec2(0.5,1.5)) * tsize);
  vec4 d = texture2D(s, (i + vec2(1.5,1.5)) * tsize);
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}`;

const SHADERS = linear => ({
  splat: `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
    varying vec2 vUv;
    void main(){ vec2 p = vUv - point; p.x *= aspect;
      vec3 splat = exp(-dot(p,p)/radius) * color;
      gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0); }`,

  advect: (linear ? '' : BILERP) + `
    uniform sampler2D uVelocity, uSource; uniform vec2 texel, dyeTexel;
    uniform float dt, dissipation; varying vec2 vUv;
    void main(){
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texel;
      vec4 result = ${linear ? 'texture2D(uSource, coord)' : 'bilerp(uSource, coord, dyeTexel)'};
      /* Stable at any dt, unlike a pow() falloff. */
      gl_FragColor = result / (1.0 + dissipation * dt); }`,

  divergence: `uniform sampler2D uVelocity; varying vec2 vUv, vL, vR, vT, vB;
    void main(){
      float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x;  if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y;  if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }`,

  curl: `uniform sampler2D uVelocity; varying vec2 vL, vR, vT, vB;
    void main(){
      float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }`,

  vorticity: `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
    varying vec2 vUv, vL, vR, vT, vB;
    void main(){
      float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;
      vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
      gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0); }`,

  pressure: `uniform sampler2D uPressure, uDivergence; varying vec2 vUv, vL, vR, vT, vB;
    void main(){
      float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      float div = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0); }`,

  gradient: `uniform sampler2D uPressure, uVelocity; varying vec2 vUv, vL, vR, vT, vB;
    void main(){
      float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
      gl_FragColor = vec4(vel, 0.0, 1.0); }`,

  clear: `uniform sampler2D uTexture; uniform float value; varying vec2 vUv;
    void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`,

  display: `uniform sampler2D uTexture; uniform float uAmt; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(uTexture, vUv).rgb;
      float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0) * uAmt;
      /* Premultiplied, or every soft edge picks up a dark rim. */
      gl_FragColor = vec4(c * a, a); }`,
});

/* Never trust an extension string; ask the driver for a complete framebuffer. */
function renderable(gl, internal, format, type) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, type, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo); gl.deleteTexture(tex);
  return ok;
}

function capabilities(gl, isGL2) {
  if (isGL2) {
    gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
    const HALF = gl.HALF_FLOAT;
    if (renderable(gl, gl.RGBA16F, gl.RGBA, HALF)) {
      const hasRG = renderable(gl, gl.RG16F, gl.RG, HALF);
      const hasR = renderable(gl, gl.R16F, gl.RED, HALF);
      /* Linear filtering of half-float is core in WebGL2, so no extension
       * check is needed here — only the WebGL1 path has to ask. */
      return { type: HALF, rgba: gl.RGBA16F,
               rg: hasRG ? gl.RG16F : gl.RGBA16F, rgFmt: hasRG ? gl.RG : gl.RGBA,
               r: hasR ? gl.R16F : gl.RGBA16F, rFmt: hasR ? gl.RED : gl.RGBA,
               linear: true };
    }
    return null;
  }
  const hf = gl.getExtension('OES_texture_half_float');
  if (hf) {
    gl.getExtension('EXT_color_buffer_half_float');
    const HALF = hf.HALF_FLOAT_OES;      /* not gl.HALF_FLOAT — different value */
    if (renderable(gl, gl.RGBA, gl.RGBA, HALF)) {
      return { type: HALF, rgba: gl.RGBA, rg: gl.RGBA, rgFmt: gl.RGBA, r: gl.RGBA, rFmt: gl.RGBA,
               linear: !!gl.getExtension('OES_texture_half_float_linear') };
    }
  }
  const ft = gl.getExtension('OES_texture_float');
  if (ft && renderable(gl, gl.RGBA, gl.RGBA, gl.FLOAT)) {
    return { type: gl.FLOAT, rgba: gl.RGBA, rg: gl.RGBA, rgFmt: gl.RGBA, r: gl.RGBA, rFmt: gl.RGBA,
             linear: !!gl.getExtension('OES_texture_float_linear') };
  }
  /* No eight-bit fallback: an 8-bit pressure field bands so badly the solve
   * gains mass, which looks far worse than simply not running. */
  return null;
}

export function mountFluid() {
  const host = $('#concierge');
  if (!host || reduce || tier.get() < 2) return false;
  if (!fine.matches) return false;
  if ((navigator.hardwareConcurrency || 2) < 8) return false;
  if (navigator.userAgentData?.mobile) return false;
  if (navigator.connection?.saveData) return false;
  if (matchMedia('(prefers-reduced-data: reduce)').matches) return false;

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-fluid';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  /* WebGL2 first, for single-channel float targets; the WebGL1 path packs
   * everything into RGBA instead. Either way this goes through the shared
   * helper, so it gets context-loss handling and counts toward the budget. */
  const ctx = context(canvas, { alpha: true, premultipliedAlpha: true }, true);
  if (!ctx) { canvas.remove(); return false; }
  const gl = ctx.gl;

  const caps = capabilities(gl, ctx.gl2);
  if (!caps) { ctx.dispose(); canvas.remove(); return false; }

  const progs = {};
  for (const [k, body] of Object.entries(SHADERS(caps.linear))) {
    const p = program(gl, body, VERT, `fluid:${k}`);
    if (!p) { ctx.dispose(); canvas.remove(); return false; }
    progs[k] = p;
  }

  function target(w, h, internal, format) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const filter = caps.linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, caps.type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo, w, h, texel: [1 / w, 1 / h],
             attach(u) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, tex); return u; } };
  }
  const swap = (a, b) => ({ get read() { return a; }, get write() { return b; }, flip() { const t = a; a = b; b = t; } });

  let velocity = swap(target(SIM, SIM, caps.rg, caps.rgFmt), target(SIM, SIM, caps.rg, caps.rgFmt));
  let dye = swap(target(DYE, DYE, caps.rgba, gl.RGBA), target(DYE, DYE, caps.rgba, gl.RGBA));
  const divergence = target(SIM, SIM, caps.r, caps.rFmt);
  const curlT = target(SIM, SIM, caps.r, caps.rFmt);
  let pressure = swap(target(SIM, SIM, caps.r, caps.rFmt), target(SIM, SIM, caps.r, caps.rFmt));

  function blit(to, prog) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fbo : null);
    gl.viewport(0, 0, to ? to.w : canvas.width, to ? to.h : canvas.height);
    drawQuad(gl, prog);
  }

  let W = 0, H = 0, pendingSize = 0;
  function size() {
    const w = Math.max(1, Math.round(canvas.clientWidth)), h = Math.max(1, Math.round(canvas.clientHeight));
    if (w === W && h === H) return;
    W = canvas.width = w; H = canvas.height = h;
  }
  size();
  new ResizeObserver(() => { cancelAnimationFrame(pendingSize); pendingSize = requestAnimationFrame(size); }).observe(canvas);

  /* Seafoam and teal, from the page's own palette. */
  const DYES = [[0.055, 0.135, 0.125], [0.035, 0.100, 0.120], [0.070, 0.145, 0.115]];
  let dyeIdx = 0;
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, seen: false, moved: false };

  host.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    /* The first move only records where the pointer is. Measuring a delta
     * against an origin it was never at threw one enormous splat every time
     * someone entered the section. */
    if (!pointer.seen) { pointer.seen = true; pointer.x = x; pointer.y = y; return; }
    pointer.dx = (x - pointer.x) * SPLAT_FORCE;
    pointer.dy = (y - pointer.y) * SPLAT_FORCE;
    pointer.x = x; pointer.y = y;
    pointer.moved = Math.abs(pointer.dx) > 0.5 || Math.abs(pointer.dy) > 0.5;
    if (pointer.moved) wake();
  }, { passive: true });
  host.addEventListener('pointerleave', () => { pointer.seen = false; }, { passive: true });

  function splat() {
    const p = progs.splat; p.use();
    gl.uniform1i(p.u('uTarget'), velocity.read.attach(0));
    gl.uniform1f(p.u('aspect'), W / Math.max(1, H));
    gl.uniform2f(p.u('point'), pointer.x, pointer.y);
    gl.uniform3f(p.u('color'), pointer.dx, pointer.dy, 0);
    gl.uniform1f(p.u('radius'), SPLAT_RADIUS / 100);
    blit(velocity.write, p); velocity.flip();

    const c = DYES[dyeIdx % DYES.length];
    gl.uniform1i(p.u('uTarget'), dye.read.attach(0));
    gl.uniform3f(p.u('color'), c[0], c[1], c[2]);
    blit(dye.write, p); dye.flip();
  }

  function step(dt) {
    gl.disable(gl.BLEND);

    let p = progs.curl; p.use();
    gl.uniform2f(p.u('texel'), ...velocity.read.texel);
    gl.uniform1i(p.u('uVelocity'), velocity.read.attach(0));
    blit(curlT, p);

    p = progs.vorticity; p.use();
    gl.uniform2f(p.u('texel'), ...velocity.read.texel);
    gl.uniform1i(p.u('uVelocity'), velocity.read.attach(0));
    gl.uniform1i(p.u('uCurl'), curlT.attach(1));
    gl.uniform1f(p.u('curl'), CURL);
    gl.uniform1f(p.u('dt'), dt);
    blit(velocity.write, p); velocity.flip();

    p = progs.divergence; p.use();
    gl.uniform2f(p.u('texel'), ...velocity.read.texel);
    gl.uniform1i(p.u('uVelocity'), velocity.read.attach(0));
    blit(divergence, p);

    /* Seeding from the previous frame is why sixteen iterations is enough. */
    p = progs.clear; p.use();
    gl.uniform1i(p.u('uTexture'), pressure.read.attach(0));
    gl.uniform1f(p.u('value'), PRESSURE_RETAIN);
    blit(pressure.write, p); pressure.flip();

    p = progs.pressure; p.use();
    gl.uniform2f(p.u('texel'), ...velocity.read.texel);
    gl.uniform1i(p.u('uDivergence'), divergence.attach(0));
    for (let i = 0; i < ITERATIONS; i++) {
      gl.uniform1i(p.u('uPressure'), pressure.read.attach(1));
      blit(pressure.write, p); pressure.flip();
    }

    p = progs.gradient; p.use();
    gl.uniform2f(p.u('texel'), ...velocity.read.texel);
    gl.uniform1i(p.u('uPressure'), pressure.read.attach(0));
    gl.uniform1i(p.u('uVelocity'), velocity.read.attach(1));
    blit(velocity.write, p); velocity.flip();

    p = progs.advect; p.use();
    gl.uniform2f(p.u('texel'), ...velocity.read.texel);
    gl.uniform2f(p.u('dyeTexel'), ...velocity.read.texel);
    gl.uniform1i(p.u('uVelocity'), velocity.read.attach(0));
    gl.uniform1i(p.u('uSource'), velocity.read.attach(0));
    gl.uniform1f(p.u('dt'), dt);
    gl.uniform1f(p.u('dissipation'), VELOCITY_DISSIPATION);
    blit(velocity.write, p); velocity.flip();

    gl.uniform2f(p.u('dyeTexel'), ...dye.read.texel);
    gl.uniform1i(p.u('uVelocity'), velocity.read.attach(0));
    gl.uniform1i(p.u('uSource'), dye.read.attach(1));
    gl.uniform1f(p.u('dissipation'), DENSITY_DISSIPATION);
    blit(dye.write, p); dye.flip();
  }

  function render() {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const p = progs.display; p.use();
    gl.uniform1i(p.u('uTexture'), dye.read.attach(0));
    gl.uniform1f(p.u('uAmt'), 0.60);
    drawQuad(gl, p);
  }

  /* Typing must never compete with a simulation. */
  let typing = false;
  host.addEventListener('focusin', e => { if (e.target.matches('input, textarea')) { typing = true; sleep(); } });
  host.addEventListener('focusout', e => { if (e.target.matches('input, textarea')) typing = false; });

  let visible = false, running = false, idle = 0;
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; visible ? wake() : sleep(); }),
    { rootMargin: '10% 0px' }).observe(host);

  function frame(_now, dtMs) {
    if (!visible || typing) { sleep(); return; }
    size();
    /* Unclamped, one tab switch overshoots advection across the whole grid
     * and the sim NaNs into a white rectangle it cannot recover from. */
    const dt = Math.min(dtMs / 1000, 1 / 60);
    if (pointer.moved) { splat(); pointer.moved = false; idle = 0; }
    else if (++idle > 260) { sleep(); return; }   /* let it settle, then stop */
    pointer.dx *= 0.86; pointer.dy *= 0.86;
    step(dt);
    render();
  }
  function wake() { if (!running && visible && !typing) { running = true; idle = 0; ticker.add(frame); } }
  function sleep() { if (running) { running = false; ticker.remove(frame); } }

  tier.onChange(t => { if (t < 2) { sleep(); ctx.dispose(); canvas.remove(); } });
  return true;
}
