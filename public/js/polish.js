/* The last ten percent: cursor, magnetic buttons, the signature, and an ocean you can switch on. */
import { $, $$, reduce, hasGsap, fine } from './core.js';

/* ---------- Custom cursor + magnetic buttons (desktop pointers only) ---------- */
(function () {
  if (!fine.matches || reduce) return;
  const dot = document.createElement('div'); dot.className = 'cur-dot';
  const ring = document.createElement('div'); ring.className = 'cur-ring';
  document.body.append(dot, ring);
  document.body.classList.add('has-cursor');
  let tx = innerWidth / 2, ty = innerHeight / 2, dx = tx, dy = ty, rx = tx, ry = ty, shown = false;

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!shown) { shown = true; dx = rx = tx; dy = ry = ty; document.body.classList.add('cur-on'); }
    const hit = e.target.closest?.('a, button, [data-ask], input, select, textarea, .spot, summary');
    ring.classList.toggle('grow', !!hit);
    document.body.classList.toggle('cur-text', !!e.target.closest?.('input, textarea, select'));
  }, { passive: true });
  addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { document.body.classList.remove('cur-on'); shown = false; } }, { passive: true });
  document.addEventListener('mouseleave', () => document.body.classList.remove('cur-on'));
  document.addEventListener('mouseenter', () => { if (shown) document.body.classList.add('cur-on'); });

  (function loop() {
    requestAnimationFrame(loop);
    dx += (tx - dx) * .6; dy += (ty - dy) * .6;
    rx += (tx - rx) * .15; ry += (ty - ry) * .15;
    dot.style.transform = `translate3d(${dx}px,${dy}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
  })();

  /* Magnetic pull on primary buttons. */
  $$('.btn').forEach(btn => {
    let raf = 0;
    const move = e => {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const mx = e.clientX - cx, my = e.clientY - cy;
      const inside = Math.abs(mx) < r.width * .7 + 24 && Math.abs(my) < r.height * .7 + 24;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        btn.style.transform = inside ? `translate(${mx * .25}px, ${my * .25}px)` : '';
      });
    };
    btn.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') move(e); }, { passive: true });
    btn.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); btn.style.transform = ''; });
  });
})();

/* ---------- Signature draw-on ---------- */
(function () {
  const sig = $('#sig'); if (!sig) return;
  const text = sig.querySelector('text');
  const draw = () => {
    if (!hasGsap || reduce) { sig.classList.add('on'); return; }
    gsap.timeline({ scrollTrigger: { trigger: '.meet', start: 'top 70%', once: true } })
      .to(text, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' })
      .to(text, { fillOpacity: 1, duration: .8, ease: 'power2.out' }, '-=.5');
  };
  /* Wait for the real face — the stroke path is the font's outline. */
  const t = setTimeout(draw, 1500);
  if (document.fonts?.load) {
    document.fonts.load('italic 300 104px Fraunces').then(() => { clearTimeout(t); draw(); }).catch(() => {});
  }
})();

/* ---------- Synthesized ocean ambience ---------- */
(function () {
  const btn = $('#soundBtn'); if (!btn) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { btn.remove(); return; }
  let ctx = null, master = null, on = false;

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    /* Four seconds of noise, looped, is enough to read as surf. */
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 380; low.Q.value = .7;
    const swell = ctx.createGain(); swell.gain.value = .5;
    src.connect(low).connect(swell).connect(master);

    const foamSrc = ctx.createBufferSource(); foamSrc.buffer = buf; foamSrc.loop = true;
    const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 1200;
    const foamGain = ctx.createGain(); foamGain.gain.value = .04;
    foamSrc.connect(high).connect(foamGain).connect(master);

    /* Two slow oscillators give the set its rise and fall. */
    const lfoF = ctx.createOscillator(); lfoF.frequency.value = .07;
    const lfoFGain = ctx.createGain(); lfoFGain.gain.value = 180;
    lfoF.connect(lfoFGain).connect(low.frequency);

    const lfoS = ctx.createOscillator(); lfoS.frequency.value = .045;
    const lfoSGain = ctx.createGain(); lfoSGain.gain.value = .35;
    lfoS.connect(lfoSGain).connect(swell.gain);

    [src, foamSrc, lfoF, lfoS].forEach(n => n.start());
  }

  btn.addEventListener('click', async () => {
    try {
      if (!ctx) build();
      await ctx.resume();                        /* must happen inside the gesture on iOS */
      on = !on;
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('on', on);
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(on ? .22 : 0, now + (on ? 2.5 : 1.2));
      if (!on) setTimeout(() => { if (!on) ctx.suspend(); }, 1300);
    } catch { btn.remove(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden && on) ctx.suspend();
    else if (!document.hidden && on) ctx.resume();
  });
})();
