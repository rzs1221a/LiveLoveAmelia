/* Hero: WebGL sea shader + intro choreography (held until the curtain lifts). */
import { $, $$, reduce, hasGsap } from './core.js';
import { loaderDone } from './preloader.js';

/* ---------- Ocean shader ---------- */
(function sea() {
  const c = $('#sea'); if (!c || reduce) return;
  const gl = c.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;
  const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const fs = `precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
  void main(){
    vec2 uv=gl_FragCoord.xy/r; vec2 q=uv; q.x*=r.x/r.y;
    float hor=0.60+0.015*sin(t*0.05);
    vec3 sky1=vec3(0.06,0.12,0.19), sky2=vec3(0.62,0.70,0.74), sea1=vec3(0.05,0.10,0.15), sea2=vec3(0.15,0.29,0.36);
    vec3 col;
    float wide=smoothstep(0.8,1.3,r.x/r.y); float sx=mix(0.86,0.72,wide);
    if(uv.y>hor){
      float k=(uv.y-hor)/(1.-hor);
      col=mix(sky2,sky1,pow(k,0.55));
      float cl=fbm(vec2(q.x*1.6+t*0.012,uv.y*3.0));
      col+=vec3(0.10,0.12,0.13)*smoothstep(0.45,0.8,cl)*(1.-k);
      float sun=exp(-pow(length((uv-vec2(sx+m.x*0.02,hor+0.11+m.y*0.01))*vec2(r.x/r.y,1.))*9.5,2.));
      col+=vec3(0.92,0.93,0.90)*sun*mix(0.30,0.45,wide);
    } else {
      float d=(hor-uv.y)/hor;                       /* 0 at horizon, 1 at bottom */
      float persp=1./(d*6.+0.06);
      vec2 w=vec2(q.x*persp*1.4+m.x*0.15, persp*2.2+t*0.22);
      float wv=fbm(w*1.3)*0.7+fbm(w*3.1+t*0.05)*0.3;
      float crest=smoothstep(0.62,0.9,wv);
      col=mix(sea1,sea2,d*0.9+wv*0.25);
      float glint=exp(-pow(abs(q.x-(sx+m.x*0.02)*r.x/r.y)*(2.5+d*9.),2.))*(1.-d)*(0.5+wv);
      col+=vec3(0.90,0.94,0.94)*glint*0.55*pow(1.-d,1.5);
      col+=vec3(0.8,0.88,0.9)*crest*0.10*(1.-d);
      col=mix(col,sky2*0.9,pow(1.-d,14.)*0.5);        /* haze at horizon */
    }
    float vig=smoothstep(1.2,0.35,length(uv-vec2(0.5,0.45)));
    col*=0.85+0.15*vig;
    gl_FragColor=vec4(col,1.);
  }`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const p = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
  const ur = gl.getUniformLocation(pr, 'r'), ut = gl.getUniformLocation(pr, 't'), um = gl.getUniformLocation(pr, 'm');
  let mx = 0, my = 0, tx = 0, ty = 0, vis = true;
  addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5); }, { passive: true });
  function size() { const dpr = Math.min(devicePixelRatio, 1.5); c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; gl.viewport(0, 0, c.width, c.height); }
  size(); addEventListener('resize', size);
  new IntersectionObserver(es => vis = es[0].isIntersecting).observe(c);
  const t0 = performance.now();
  (function loop() { requestAnimationFrame(loop); if (!vis) return; mx += (tx - mx) * .04; my += (ty - my) * .04; gl.uniform2f(ur, c.width, c.height); gl.uniform1f(ut, (performance.now() - t0) / 1000); gl.uniform2f(um, mx, my); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); })();
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
