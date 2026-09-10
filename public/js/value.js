/* Seller flow: three quick steps, then the concierge drafts a Listing Story and Kelly gets the lead. */
import { $, $$, reduce, hasGsap, fmtBrief, sessionId, optsGroup } from './core.js';
import { postNetlifyForm } from './leads.js';
import { turns } from './concierge.js';

const AREA_OPTIONS = [
  'Amelia Island Plantation', 'Crane Island', 'Fernandina Beach Historic District',
  'North Beach / Fort Clinch', 'South End near the Ritz-Carlton', 'Yulee',
  'Callahan / Hilliard / Bryceville', 'Elsewhere in Nassau County',
];

(function () {
  const form = $('#valForm'); if (!form) return;
  const area = $('#vArea'), nav = $('#valNav'), back = $('#valBack'), next = $('#valNext');
  const steps = $$('.step', form);
  const body = $('#storyBody'), forTag = $('#storyFor');
  const picks = {};
  let step = 1, sent = false;

  area.innerHTML = AREA_OPTIONS.map(a => `<option>${a}</option>`).join('');
  optsGroup(form, picks);

  function go(n) {
    const prev = step;
    step = Math.min(Math.max(n, 1), steps.length);
    steps.forEach(s => s.classList.toggle('on', +s.dataset.step === step));
    $$('li', nav).forEach((li, i) => { li.classList.toggle('on', i + 1 === step); li.classList.toggle('done', i + 1 < step); });
    back.hidden = step === 1;
    next.hidden = step === steps.length;
    const el = steps[step - 1];
    if (hasGsap && !reduce && prev !== step) gsap.from(el, { opacity: 0, x: step > prev ? 18 : -18, duration: .4, ease: 'power3.out' });
  }

  function valid(n) {
    if (n === 1) return !!area.value;
    if (n === 2) return !!picks.type;
    return !!$('#vName').value.trim() && (!!$('#vEmail').value.trim() || !!$('#vPhone').value.trim());
  }
  function nudge(n) {
    const el = steps[n - 1];
    el.classList.add('err'); setTimeout(() => el.classList.remove('err'), 900);
  }

  next.addEventListener('click', () => { if (valid(step)) go(step + 1); else nudge(step); });
  back.addEventListener('click', () => go(step - 1));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!valid(3)) { nudge(3); return; }
    if (sent) return;
    const v = {
      area: area.value, address: $('#vAddress').value.trim(),
      type: picks.type || '', beds: $('#vBeds').value, baths: $('#vBaths').value, sqft: $('#vSqft').value,
      condition: picks.condition || '', timeline: picks.timeline || '', upgrades: $('#vUpgrades').value.trim(),
      name: $('#vName').value.trim(), email: $('#vEmail').value.trim(), phone: $('#vPhone').value.trim(),
    };
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; sent = true;
    body.classList.remove('empty'); body.textContent = 'Drafting…';
    forTag.textContent = `${v.type || 'Home'} · ${v.area}`;

    let text = '';
    try {
      const r = await fetch('/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, session: sessionId() }) });
      if (!r.ok) throw 0;
      const reader = r.body.getReader(), dec = new TextDecoder();
      while (true) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); body.innerHTML = fmtBrief(text); }
      if (!text.trim()) throw 0;
      turns.push(
        { role: 'user', content: `I'm thinking about selling my ${v.type || 'home'} in ${v.area}. Write my listing story.` },
        { role: 'assistant', content: text.slice(0, 1500) });
      body.innerHTML = fmtBrief(text) + '<div class="story-cta"><button class="btn" type="button" data-ask="You wrote my listing story. What would Kelly want to know next before she prices it?">Ask what Kelly needs next <span class="arr">→</span></button></div>';
    } catch {
      body.textContent = "Kelly will do this one in person — she has your details and will bring the comparable sales with her. Want it sooner? 512-578-9942.";
    } finally {
      /* The lead goes to Kelly whether or not the story drafted. */
      const ok = await postNetlifyForm('valuation', { ...v, story: text.slice(0, 6000), session: sessionId(), page: location.href });
      btn.disabled = false;
      btn.innerHTML = ok ? 'Sent to Kelly ✓' : 'Text Kelly: 512-578-9942';
    }
  });

  go(1);
})();
