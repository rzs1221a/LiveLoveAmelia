/* Neighborhood match quiz + relocation brief. */
import { $, reduce, hasGsap, esc, fmtBrief, sessionId, optsGroup } from './core.js';
import { lightMap } from './map.js';
import { turns } from './concierge.js';

/* ---------- Quiz ---------- */
const picks = {};
(function () {
  const quiz = $('#quiz'); if (!quiz) return;
  optsGroup(quiz, picks);
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
})();

/* ---------- Relocation brief ---------- */
(function () {
  const form = $('#reloForm'); if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const city = $('#reloCity').value.trim(); if (!city) return;
    const body = $('#briefBody'), tag = $('#briefFor'); const btn = e.target.querySelector('button');
    body.classList.remove('empty'); body.textContent = 'Drafting…'; tag.textContent = `${city} → Amelia Island`; btn.disabled = true;
    const q = `I'm moving from ${city}. Who's moving: ${$('#reloWho').value}. Purpose: ${$('#reloWhy').value}. Budget: ${$('#reloBudget').value}. Write my relocation brief.`;
    let text = '';
    try {
      const r = await fetch('/api/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'relocate', session: sessionId(), messages: [{ role: 'user', content: q }] }) });
      if (!r.ok) throw 0;
      const reader = r.body.getReader(), dec = new TextDecoder();
      while (true) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); body.innerHTML = fmtBrief(text); }
      if (!text.trim()) throw 0;
      turns.push({ role: 'user', content: q }, { role: 'assistant', content: text.slice(0, 1500) });
    } catch { body.textContent = "Couldn't draft the brief right now — Kelly can walk you through it live: 512-578-9942."; }
    finally { btn.disabled = false; }
  });
})();
