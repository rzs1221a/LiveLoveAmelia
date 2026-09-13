/* Kelly's private page. Everything on it is read from the site's own stores. */
import { $, $$, esc, countTo, store, splitChips } from './core.js';
let key = null;


async function load() {
  let r;
  try { r = await (await fetch(`/api/kelly?key=${encodeURIComponent(key)}&days=60`)).json(); } catch { r = null; }
  const st = r?.stats || {};
  for (const el of $$('#stats b')) countTo(el, Number(st[el.dataset.k] || 0), n => String(Math.round(n)));
  if (!st.conversations && !st.leads) $('#statsNote').hidden = false;
  renderInbox(r?.leads || []);
}

function renderInbox(leads) {
  const box = $('#inbox'); if (!leads.length) return;
  box.innerHTML = leads.map(l => `<details class="own-lead">
    <summary><b>${esc(l.name || 'No name given')}</b><span>${esc(l.contact || '')}</span><em>${esc(when(l.ts))}</em><i>${esc(label(l.type))}</i></summary>
    <p class="own-sum">${esc(l.summary || '')}</p>
    ${l.transcript ? `<pre>${esc(l.transcript)}</pre>` : ''}
  </details>`).join('');
}
const label = t => ({ handoff: 'from a conversation', valuation: 'seller · listing story', contact: 'contact form' }[t] || t);
const when = ts => { const d = new Date(ts), h = (Date.now() - ts) / 36e5; return h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };

/* The arithmetic, live. The fee stays hidden until one is set. */
const FEE = null;   /* set a number here when a monthly figure is agreed */
if (FEE) { $('#feeRow').hidden = false; $('#mFee').value = FEE; }
function math() {
  const lead = +$('#mLead').value || 0, conv = +$('#mConv').value || 0, comm = +$('#mComm').value || 0, fee = +($('#mFee').value || 0);
  const perLead = lead ? Math.round(lead / Math.max(conv, 0.0001)) : 0;
  let html = `<p>A shared portal lead costs you <b>$${lead.toLocaleString()}</b>. That buys <b>${perLead.toLocaleString()}</b> full concierge conversations here, each one a person who came to <em>your</em> site and asked <em>your</em> questions.</p>`;
  if (fee) html += `<p>One closing at <b>$${comm.toLocaleString()}</b> against a <b>$${fee.toLocaleString()}</b> month: one lead a quarter pays for it <b>${Math.round(comm / (fee * 3))}×</b> over.</p>`;
  else html += `<p>One closing here is worth about <b>$${comm.toLocaleString()}</b>. Everything on this page costs pennies to run.</p>`;
  $('#mathOut').innerHTML = html;
}
$$('#math input').forEach(i => i.addEventListener('input', math)); math();

/* Sixty seconds: three real questions through the live concierge. */
const SCRIPT = [
  "We're moving from Boston with two kids. Where should we even start looking?",
  "What about flood insurance on the island?",
  "Can Kelly show us Crane Island this month?",
];
$('#demoBtn').addEventListener('click', async () => {
  const btn = $('#demoBtn'); btn.disabled = true; $('#demoChat').hidden = false;
  const log = $('#demoLog'); log.innerHTML = '';
  const turns = [];
  const add = (cls, t) => { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  for (const q of SCRIPT) {
    add('u', q); turns.push({ role: 'user', content: q });
    const b = add('k think', 'Thinking');
    let text = '';
    try {
      const r = await fetch('/api/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo': 'amelia-preview-2026' }, body: JSON.stringify({ messages: turns, session: 'kelly-demo' }) });
      const rd = r.body.getReader(), dec = new TextDecoder();
      while (true) { const { value, done } = await rd.read(); if (done) break; text += dec.decode(value, { stream: true }); b.classList.remove('think'); b.textContent = splitChips(text).body; log.scrollTop = log.scrollHeight; }
    } catch { b.textContent = 'The concierge is locked right now; open the site with the demo link first.'; break; }
    const body = splitChips(text).body; b.textContent = body; turns.push({ role: 'assistant', content: body });
    await new Promise(r => setTimeout(r, 900));
  }
  const card = add('k handoff', ''); card.innerHTML = `<b>Want Kelly to pick this up personally?</b><p>This is the moment a visitor becomes a lead. Their name and number land in your inbox with everything above.</p>`;
  btn.disabled = false; btn.textContent = 'Watch it again';
});

/* Gate last, after every helper above exists. */
key = new URLSearchParams(location.search).get('key');
if (!key) { $('#gate').hidden = false; }
else {
  $('#gate').remove(); $('#own').hidden = false;
  store.set('lla:demo', 'amelia-preview-2026');   /* one link unlocks the demo too */
  $('#brainLink').href = `/brain.html?key=${encodeURIComponent(key)}`;
  load();
}
