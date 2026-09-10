/* WebGL plumbing: context acquisition, shader compilation that actually
 * reports failure, and the fullscreen quad every view draws.
 *
 * The old hero never checked COMPILE_STATUS, so a broken shader was a silently
 * black canvas — the worst possible failure, because it looks deliberate. */
import { precision, VERT } from './glsl.js';

/* Exposed so the smoke test can assert we never leak contexts. */
export const stats = { contexts: 0, created: 0, programs: 0, errors: [] };

const CTX_OPTS = {
  alpha: true, depth: false, stencil: false, antialias: false,
  preserveDrawingBuffer: false, premultipliedAlpha: true,
  powerPreference: 'high-performance',
};

/* Returns { gl, gl2, canvas, onLost, onRestored, dispose } or null.
 * `prefer2` asks for WebGL2 first, which the fluid simulation wants for its
 * single-channel float render targets. */
export function context(canvas, opts = {}, prefer2 = false) {
  const o = { ...CTX_OPTS, ...opts };
  let gl = null, gl2 = false;
  try {
    if (prefer2) { gl = canvas.getContext('webgl2', o); gl2 = !!gl; }
    if (!gl) gl = canvas.getContext('webgl', o) || canvas.getContext('experimental-webgl', o);
  } catch {}
  if (!gl) return null;
  stats.contexts++; stats.created++;

  const handlers = { lost: [], restored: [] };
  /* Without preventDefault the context never comes back, and the draw loop
   * keeps calling into a dead context forever. */
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    handlers.lost.forEach(f => { try { f(); } catch {} });
  });
  canvas.addEventListener('webglcontextrestored', () => {
    handlers.restored.forEach(f => { try { f(); } catch {} });
  });

  return {
    gl, gl2, canvas,
    onLost: f => handlers.lost.push(f),
    onRestored: f => handlers.restored.push(f),
    dispose() {
      try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
      stats.contexts--;
    },
  };
}

/* Compile and link, reporting real errors. Returns null on failure so the
 * caller can fall back to whatever static treatment the CSS already provides. */
export function program(gl, frag, vert = VERT, label = 'shader') {
  const make = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) || 'unknown';
      stats.errors.push(`${label}: ${log}`);
      console.error(`[gl] ${label} failed to compile:`, log);
      gl.deleteShader(s); return null;
    }
    return s;
  };
  const vs = make(gl.VERTEX_SHADER, vert);
  const fs = make(gl.FRAGMENT_SHADER, precision(gl) + '\n' + frag);
  if (!vs || !fs) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); return null; }

  const pr = gl.createProgram();
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(pr) || 'unknown';
    stats.errors.push(`${label}: ${log}`);
    console.error(`[gl] ${label} failed to link:`, log);
    gl.deleteProgram(pr); return null;
  }
  stats.programs++;

  const cache = new Map();
  let attrib = -2;
  return {
    handle: pr,
    use() { gl.useProgram(pr); },
    /* Cached alongside the uniforms; it was being queried on every draw. */
    quadAttrib() { if (attrib === -2) attrib = gl.getAttribLocation(pr, 'p'); return attrib; },
    /* Uniform locations are looked up once and reused. */
    u(name) {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(pr, name));
      return cache.get(name);
    },
  };
}

/* One quad buffer per context, shared by every program drawn into it. */
const quads = new WeakMap();
export function quad(gl) {
  if (!quads.has(gl)) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    quads.set(gl, b);
  }
  return quads.get(gl);
}

export function drawQuad(gl, prog) {
  const b = quad(gl);
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  const loc = prog.quadAttrib ? prog.quadAttrib() : gl.getAttribLocation(prog.handle, 'p');
  if (loc < 0) return;
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
