/* Caustics — the dappled net of light that water throws onto a surface.
 *
 * Additive and very faint. It sits over the dark sections the same way the
 * film grain already sits over everything, so the same bargain applies: at
 * this alpha it reads on flat ground and disappears over text. */
import { $ } from '../../core.js';
import { NOISE, WARP, OUT } from '../glsl.js';
import { register } from '../sched.js';

const FRAG = NOISE + WARP + OUT + `
uniform vec4 uRect; uniform vec2 uSize;
uniform float uT, uAmt;
uniform vec3 uTint;

void main(){
  vec2 uv = (gl_FragCoord.xy - uRect.xy) / uSize;
  vec2 p = vec2(uv.x * (uSize.x / uSize.y), uv.y) * 2.6;

  /* Two warped fields at different rates. Crossing them is what produces the
   * moving cell structure; a single one just looks like drifting fog. */
  float a = warped(p + vec2(0.0, uT * 0.05), uT);
  float b = warped(p * 1.7 - vec2(uT * 0.04, 0.0), uT * 0.8);

  /* The sharp ridges are the point — caustics are creases of focused light,
   * not soft blobs, so fold the field rather than smoothing it. */
  float ridge = 1.0 - abs(a - b) * 3.4;
  ridge = pow(clamp(ridge, 0.0, 1.0), 5.0);

  float shimmer = 0.85 + 0.15 * sin(uT * 0.7 + a * 8.0);
  float k = ridge * shimmer * uAmt;

  /* Fades out at the edges so the band has no boundary of its own. */
  k *= smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.78, uv.y);

  writePremul(uTint, clamp(k, 0.0, 1.0));
}`;

export function mountCaustics(layer) {
  const prog = layer.shader('caustics', FRAG);
  if (!prog) return 0;
  let n = 0;
  for (const [sel, amt] of [['#contact', 0.10], ['footer', 0.07]]) {
    const el = $(sel);
    if (!el) continue;
    register({
      el, layer, fps: 20, priority: 6, minTier: 2,
      draw(v, now) {
        layer.drawView(prog, v.rect, (gl, p) => {
          gl.uniform1f(p.u('uT'), now);
          gl.uniform1f(p.u('uAmt'), amt);
          gl.uniform3f(p.u('uTint'), 0.612, 0.761, 0.741);
        });
      },
    });
    n++;
  }
  return n;
}
