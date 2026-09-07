/* Love. Live. Amelia. — app.js (Seamark) */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof gsap !== 'undefined';
if (hasGsap && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);

/* ---------- Ocean shader (hero) ---------- */
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

/* ---------- Intro + hero choreography ---------- */
(function () {
  const lines = $$('.hero h1 .l span');
  if (!hasGsap || reduce) { lines.forEach(s => s.style.transform = 'none'); return; }
  const tl = gsap.timeline();
  tl.to(lines, { y: 0, duration: 1.1, stagger: .12, ease: 'power4.out' }, 0.1)
    .from('.hero .eyebrow, .hero .sub, .hero .cta', { opacity: 0, y: 18, duration: .8, stagger: .1, ease: 'power3.out' }, '-=.7')
    .from('#portrait', { opacity: 0, y: 40, duration: 1.2, ease: 'power3.out' }, '-=.9');
  gsap.to('#portrait', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
})();

/* ---------- Nav behaviour ---------- */
(function () {
  const nav = $('#nav'); let last = 0;
  const hero = $('.hero');
  function upd() {
    const y = scrollY; const past = y > hero.offsetHeight - 80;
    nav.classList.toggle('solid', y > 40);
    nav.classList.toggle('hide', y > last && y > 300 && past);
    last = y;
    $('#fab').classList.toggle('show', y > 700 && !inView($('#concierge')));
  }
  function inView(el) { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }
  addEventListener('scroll', upd, { passive: true }); upd();
  const drawer = $('#drawer');
  $('#burger').onclick = () => drawer.classList.add('open');
  $('#drawerX').onclick = () => drawer.classList.remove('open');
  $$('#drawer a').forEach(a => a.onclick = () => drawer.classList.remove('open'));
})();

/* ---------- Split-text reveals, counters, reveal-on-scroll ---------- */
(function () {
  $$('.split').forEach(el => {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; const i = document.createElement('span'); i.textContent = tok; w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });
  if (hasGsap && !reduce) {
    $$('.split').forEach(el => gsap.to(el.querySelectorAll('.w span'), { y: 0, duration: .9, stagger: .035, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
    $$('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0); const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' }, onUpdate: () => el.textContent = o.v.toFixed(dec) });
    });
  } else { $$('.split .w span').forEach(s => s.style.transform = 'none'); $$('[data-count]').forEach(el => el.textContent = el.dataset.count); }
  const els = $$('.rv');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.remove('pre'); else io.observe(e); });
  setTimeout(() => els.forEach(e => e.classList.remove('pre')), 3000);
})();

/* ---------- Community reel (pinned horizontal) ---------- */
(function () {
  const track = $('#reel'); if (!track) return;
  if (!hasGsap || reduce || innerWidth < 900) { track.parentElement.style.overflowX = 'auto'; track.style.paddingBottom = '20px'; return; }
  const dist = () => track.scrollWidth - innerWidth;
  gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.reel', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1 } });
})();

/* ---------- Island map ---------- */
const PLACES = {
  fort: { k: 'North tip', h: 'Fort Clinch & the north end', p: 'Maritime forest, a Civil War fort, and the quietest beaches on the island. Homes here trade ocean noise for oak canopy and a five-minute bike to downtown.', f: ['State park', 'Bike trails', 'Old-Florida lots'], ask: 'What is it like living near Fort Clinch on the north end of Amelia Island?' },
  historic: { k: 'Downtown charm', h: 'Fernandina Beach Historic District', p: 'Fifty blocks of Victorian porches around Centre Street. Shrimp boats at the marina, brunch on foot, and the kind of neighbors who wave. Older homes, more character, more upkeep.', f: ['Walkable', 'Victorian', 'Marina'], ask: "I love historic homes. What's it like to live in Fernandina Beach's Historic District?" },
  north: { k: 'Beach life', h: 'North Beach & Main Beach', p: 'The island\'s everyday beach — Main Beach Park, the boardwalk, and streets of cottages and newer builds a block or two off the sand.', f: ['Beach blocks', 'Cottages', 'Boardwalk'], ask: 'What are the beach neighborhoods near Main Beach and North Beach like on Amelia Island?' },
  crane: { k: 'New construction', h: 'Crane Island', p: 'A brand-new island village on the Amelia River — coastal cottages with porches, boardwalks, and a community dock. Still choosing finishes on many homes.', f: ['New build', 'Intracoastal', 'Dock'], ask: "What is Crane Island like? I'm interested in new construction on Amelia Island." },
  yulee: { k: 'Mainland value', h: 'Yulee', p: 'Ten minutes over the bridge: newer subdivisions, bigger lots, A-rated schools, and the island still in your weekend. Where many first homes and family moves land.', f: ['More house', 'Schools', 'Newer'], ask: 'We want more house for the money and good schools. Should we look at Yulee instead of the island?' },
  south: { k: 'Oceanfront luxury', h: 'South End & the Ritz-Carlton', p: 'Dune-front estates and resort condos on the quietest stretch of sand, with the Ritz as your neighbor and the Plantation next door.', f: ['Oceanfront', 'Resort', 'Estates'], ask: "What's the South End of Amelia Island near the Ritz-Carlton like for a luxury beach home?" },
  plantation: { k: 'The resort', h: 'Amelia Island Plantation', p: 'Gated, oak-canopied, ocean and marsh views, golf and tennis and the Omni at your doorstep. Second homes and forever homes alike.', f: ['Gated', 'Golf', 'Marsh & ocean'], ask: 'Tell me about living in Amelia Island Plantation — who it suits, what homes there are like, and what I should know before buying.' },
};
const MATCH_TO_SPOT = { 'plantation': 'plantation', 'crane': 'crane', 'historic': 'historic', 'fort clinch': 'fort', 'north beach': 'north', 'south end': 'south', 'ritz': 'south', 'yulee': 'yulee', 'callahan': 'yulee', 'hilliard': 'yulee', 'bryceville': 'yulee' };
function showPlace(id) {
  const d = PLACES[id]; if (!d) return;
  $$('.map .spot').forEach(s => s.classList.toggle('hot', s.dataset.id === id));
  const el = $('#place');
  el.innerHTML = `<span class="k">${d.k}</span><h3>${d.h}</h3><p>${d.p}</p><div class="facts">${d.f.map(f => `<span>${f}</span>`).join('')}</div><button class="btn" type="button" data-ask="${d.ask.replace(/"/g, '&quot;')}">Ask the concierge about it <span class="arr">→</span></button>`;
  if (hasGsap && !reduce) gsap.from(el.children, { opacity: 0, y: 14, duration: .6, stagger: .06, ease: 'power3.out' });
}
$$('.map .spot').forEach(s => { s.addEventListener('click', () => showPlace(s.dataset.id)); s.addEventListener('mouseenter', () => showPlace(s.dataset.id)); });
showPlace('historic');
function lightMap(areaName) { const key = Object.keys(MATCH_TO_SPOT).find(k => areaName.toLowerCase().includes(k)); if (key) showPlace(MATCH_TO_SPOT[key]); }

/* ---------- Listings ---------- */
const LISTINGS = [
  { price: 2225000, area: 'Fernandina Beach', type: 'Single Family', bd: 3, ba: 3.5, sf: 3061, tag: 'Oceanfront' },
  { price: 1980000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3.5, sf: 3901, tag: 'Just listed' },
  { price: 1997000, area: 'Fernandina Beach', type: 'Condominium', bd: 3, ba: 3.5, sf: 2180, tag: 'Ocean view' },
  { price: 1295000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 3234, tag: 'Just listed' },
  { price: 860000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 2690, tag: 'Just listed' },
  { price: 699900, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 2836, tag: 'Just listed' },
];
const fmt = n => '$' + n.toLocaleString('en-US');
(function () {
  const grid = $('#listingGrid'); if (!grid) return;
  const arts = ['<path d="M0 60 L60 20 L120 60 L120 100 L0 100Z"/><path d="M130 60 L200 30 L270 60 L270 100 L130 100Z"/>', '<path d="M20 100 L20 30 L280 30 L280 100Z"/><path d="M60 100 L60 55 L120 55 L120 100 M180 100 L180 55 L240 55 L240 100"/>', '<path d="M0 90 C60 70 100 95 150 80 S250 65 300 85 L300 100 L0 100Z"/><circle cx="240" cy="30" r="14"/>'];
  LISTINGS.forEach((l, i) => {
    const el = document.createElement('article'); el.className = 'card rv pre';
    el.innerHTML = `<div class="ph"><div class="sky"></div><svg viewBox="0 0 300 100" preserveAspectRatio="none" fill="none" stroke="#F3F0EA" stroke-width="1">${arts[i % 3]}</svg><span class="pill">${l.tag}</span><button type="button" class="ask" data-ask="I'm looking at a ${l.bd}-bed, ${l.ba}-bath ${l.type.toLowerCase()} in ${l.area}, ${l.sf.toLocaleString()} sq ft, listed at ${fmt(l.price)}. What should I know, and what questions should I ask Kelly?">Ask about this home ✦</button></div><div class="b"><div class="price">${fmt(l.price)}</div><div class="addr">${l.type} · ${l.area}, FL 32034</div><div class="specs"><span><b>${l.bd}</b> bd</span><span><b>${l.ba}</b> ba</span><span><b>${l.sf.toLocaleString()}</b> sq ft</span></div></div>`;
    grid.appendChild(el);
    el.addEventListener('pointermove', e => { if (reduce) return; const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `translateY(-4px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg)`; });
    el.addEventListener('pointerleave', () => el.style.transform = '');
  });
  // late-added cards: observe
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.card.pre').forEach(c => io.observe(c));
})();

/* ---------- Concierge ---------- */
const turns = []; let ctl = null, busy = false;
const log = $('#log'), input = $('#chatInput'), sendBtn = $('#sendBtn'), stopBtn = $('#stopBtn'), chatEl = $('#chat'), status = $('#chatStatus');
function add(cls, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
function setBusy(b) { busy = b; chatEl.classList.toggle('busy', b); sendBtn.disabled = b; input.disabled = b; }
function offline() { status.innerHTML = '<i style="background:#B8AC9A"></i>Offline'; }
function splitChips(text) {
  const i = text.lastIndexOf('§§');
  if (i < 0) return { body: text, chips: [] };
  let chips = []; try { chips = JSON.parse(text.slice(i + 2).trim()); } catch { chips = []; }
  return { body: text.slice(0, i).trimEnd(), chips: Array.isArray(chips) ? chips.slice(0, 3).map(String) : [] };
}
function renderChips(chips) {
  $$('.chips', log).forEach(c => c.remove());
  if (!chips.length) return;
  const w = document.createElement('div'); w.className = 'chips';
  chips.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => ask(q); w.appendChild(b); });
  log.appendChild(w); log.scrollTop = log.scrollHeight;
}
async function ask(q) {
  q = (q || '').trim(); if (!q || busy) return;
  $$('.chips', log).forEach(c => c.remove());
  add('u', q); turns.push({ role: 'user', content: q });
  if (turns.length > 16) turns.splice(0, turns.length - 16);
  const bubble = add('k think', 'Thinking'); setBusy(true); ctl = new AbortController();
  let text = '';
  try {
    const r = await fetch('/api/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: turns }), signal: ctl.signal });
    if (r.status === 429) throw { code: 'rate' }; if (r.status === 503) throw { code: 'off' }; if (!r.ok) throw { code: 'up' };
    const reader = r.body.getReader(), dec = new TextDecoder();
    while (true) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); bubble.classList.remove('think'); bubble.textContent = splitChips(text).body; log.scrollTop = log.scrollHeight; }
    if (!text.trim()) throw { code: 'up' };
    const { body, chips } = splitChips(text);
    bubble.textContent = body; turns.push({ role: 'assistant', content: body }); renderChips(chips);
    $('#ctxField').value = turns.slice(-6).map(t => `${t.role}: ${t.content}`).join('\n').slice(0, 4000);
  } catch (e) {
    bubble.classList.remove('think');
    if (e.name === 'AbortError') { const b = splitChips(text).body; if (b) { bubble.textContent = b; turns.push({ role: 'assistant', content: b }); } else { bubble.textContent = '(stopped)'; turns.pop(); } }
    else if (e.code === 'rate') { bubble.textContent = 'The concierge is catching its breath — try again in a moment.'; turns.pop(); }
    else if (e.code === 'off') { bubble.textContent = "The concierge is offline right now. Kelly's a text away: 512-578-9942."; turns.pop(); offline(); }
    else { bubble.textContent = splitChips(text).body || 'Connection hiccup. Try that again?'; turns.pop(); }
  } finally { setBusy(false); input.focus({ preventScroll: true }); }
}
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
stopBtn.addEventListener('click', () => ctl && ctl.abort());
function goAsk(q) { $('#concierge').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); setTimeout(() => ask(q), 450); }
document.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (!b) return; e.preventDefault(); goAsk(b.dataset.ask); });
$('#fab').addEventListener('click', () => { $('#concierge').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => input.focus(), 600); });

/* ---------- ⌘K palette ---------- */
(function () {
  const pal = $('#pal'), pin = $('#palInput'), sug = $('#palSug');
  const S = [
    ['Where should a family from up north look?', 'Relocate'], ['Plantation vs. Historic District?', 'Compare'], ['How does Kelly price a listing?', 'Sell'], ['What does flood insurance look like here?', 'Buy'], ['Is Crane Island worth a look?', 'New build'],
  ];
  let sel = -1;
  function render(q) {
    const list = q ? [[q, 'Ask']] : S;
    sug.innerHTML = list.map((s, i) => `<button type="button" data-q="${s[0].replace(/"/g, '&quot;')}"><span>${s[0]}</span><span>${s[1]}</span></button>`).join('');
    sel = -1;
  }
  function open() { pal.classList.add('open'); pin.value = ''; render(''); setTimeout(() => pin.focus(), 30); }
  function close() { pal.classList.remove('open'); }
  $('#palBtn').onclick = open;
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('open') ? close() : open(); }
    if (e.key === 'Escape') { close(); $('#drawer').classList.remove('open'); }
  });
  pal.addEventListener('click', e => { if (e.target === pal) close(); });
  pin.addEventListener('input', () => render(pin.value.trim()));
  pin.addEventListener('keydown', e => {
    const btns = $$('button', sug);
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(btns.length - 1, sel + 1); btns.forEach((b, i) => b.classList.toggle('sel', i === sel)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); btns.forEach((b, i) => b.classList.toggle('sel', i === sel)); }
    if (e.key === 'Enter') { e.preventDefault(); const q = sel >= 0 ? btns[sel].dataset.q : pin.value.trim(); if (q) { close(); goAsk(q); } }
  });
  sug.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; close(); goAsk(b.dataset.q); });
})();

/* ---------- Neighborhood match ---------- */
const picks = {};
$$('#quiz .opts').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', g).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); picks[g.dataset.key] = b.textContent; }));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
$('#matchBtn').addEventListener('click', async () => {
  const res = $('#matchRes');
  if (['saturday', 'type', 'budget', 'timeline'].some(k => !picks[k])) { res.innerHTML = '<p class="placeholder">Pick one answer in every row first.</p>'; return; }
  res.innerHTML = '<p class="placeholder">Matching you to the island…</p>';
  try {
    const r = await fetch('/api/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(picks) });
    if (!r.ok) throw 0; const m = await r.json(); if (m.error) throw 0;
    res.innerHTML = `<span class="eyebrow">Your match</span><h3>${esc(m.area)}</h3><p class="why"><em style="color:var(--gold);font-family:Fraunces,serif;font-size:19px">${esc(m.tagline)}</em><br><br>${esc(m.why)}</p><p class="alt">Runner-up: <b>${esc(m.runnerUp)}</b> — ${esc(m.runnerUpWhy)}</p><div class="cta"><button class="btn primary" type="button" data-ask="The neighborhood quiz matched me to ${esc(m.area)} (Saturday: ${esc(picks.saturday)}; buying: ${esc(picks.type)}; budget: ${esc(picks.budget)}; timeline: ${esc(picks.timeline)}). What should my next steps be?">Ask what's next <span class="arr">→</span></button><a class="btn" href="#island">See it on the map</a></div>`;
    if (hasGsap && !reduce) gsap.from(res.children, { opacity: 0, y: 14, duration: .6, stagger: .07, ease: 'power3.out' });
    lightMap(m.area + ' ' + m.runnerUp);
  } catch { res.innerHTML = "<p class=\"placeholder\">Couldn't finish the match — try once more, or just ask the concierge above.</p>"; }
});

/* ---------- Relocation brief ---------- */
$('#reloForm').addEventListener('submit', async e => {
  e.preventDefault();
  const city = $('#reloCity').value.trim(); if (!city) return;
  const body = $('#briefBody'), tag = $('#briefFor'); const btn = e.target.querySelector('button');
  body.classList.remove('empty'); body.textContent = 'Drafting…'; tag.textContent = `${city} → Amelia Island`; btn.disabled = true;
  const q = `I'm moving from ${city}. Who's moving: ${$('#reloWho').value}. Purpose: ${$('#reloWhy').value}. Budget: ${$('#reloBudget').value}. Write my relocation brief.`;
  let text = '';
  try {
    const r = await fetch('/api/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'relocate', messages: [{ role: 'user', content: q }] }) });
    if (!r.ok) throw 0;
    const reader = r.body.getReader(), dec = new TextDecoder();
    while (true) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); body.innerHTML = fmtBrief(text); }
    if (!text.trim()) throw 0;
    turns.push({ role: 'user', content: q }, { role: 'assistant', content: text.slice(0, 1500) });
  } catch { body.textContent = "Couldn't draft the brief right now — Kelly can walk you through it live: 512-578-9942."; }
  finally { btn.disabled = false; }
});
function fmtBrief(t) { return esc(t).replace(/^([A-Z][A-Z0-9 &]{3,})$/gm, '<b>$1</b>'); }

/* ---------- Testimonials rotation ---------- */
(function () {
  const qs = $$('#stage .q'), dots = $$('#dots button'); let i = 0, timer;
  function go(n) { i = n % qs.length; qs.forEach((q, k) => q.classList.toggle('on', k === i)); dots.forEach((d, k) => { d.classList.remove('on'); void d.offsetWidth; if (k === i) d.classList.add('on'); }); clearTimeout(timer); if (!reduce) timer = setTimeout(() => go(i + 1), 7000); }
  dots.forEach((d, k) => d.onclick = () => go(k));
  go(0);
})();
})();
