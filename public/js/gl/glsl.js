/* Shared GLSL. One noise implementation for the whole site — it is most of
 * what makes separate effects read as one system rather than five demos. */

/* Value noise + fbm, lifted from the hero shader so both use the same field. */
export const NOISE = `
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*vnoise(p);p=p*2.07+vec2(1.7,9.2);a*=.5;}return v;}
`;

/* Domain-warped fbm — the ridged, curling look shared by foam and caustics. */
export const WARP = `
float warped(vec2 p, float t){
  vec2 q = vec2(fbm3(p + vec2(0.0, t*0.15)), fbm3(p + vec2(5.2, 1.3 - t*0.1)));
  return fbm(p + 1.6*q);
}
`;

/* Everything writes premultiplied. Straight alpha composited as premultiplied
 * rings every soft edge with a dark halo, and foam and caustics are nothing
 * but soft edges. */
export const OUT = `
void writePremul(vec3 rgb, float a){ gl_FragColor = vec4(rgb * a, a); }
`;

export const VERT = `attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}`;

/* WebGL1 does not guarantee highp in fragment shaders; ask before claiming it. */
export function precision(gl) {
  const f = gl.getShaderPrecisionFormat?.(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  return f && f.precision > 0 ? 'precision highp float;' : 'precision mediump float;';
}
