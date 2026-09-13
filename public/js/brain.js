/* The concierge's editable brain. Plain forms over /api/brain. */
import { $, $$, esc, splitChips } from './core.js';
let key = null;


const H = () => ({ 'Content-Type': 'application/json', 'x-owner': key });
let meta = null;

async function load() {
  const r = await fetch('/api/brain', { headers: H() });
  if (!r.ok) { $('#status').textContent = 'Could not load the brain.'; return; }
  meta = await r.json();
  const form = $('#brainForm');
  form.innerHTML = meta.fields.map(f => `<label class="brain-field${f.locked ? ' locked' : ''}">
    <span>${esc(f.label)}${f.locked ? ' <i>locked</i>' : ''}</span>
    <textarea name="${f.key}" ${f.locked ? 'readonly' : ''} rows="${f.key === 'identity' ? 4 : 8}">${esc(meta.current[f.key] || '')}</textarea>
  </label>`).join('');
}
const draft = () => Object.fromEntries($$('#brainForm textarea').filter(t => !t.readOnly).map(t => [t.name, t.value]));

$('#saveBtn').addEventListener('click', async () => {
  $('#status').textContent = 'Saving…';
  const r = await fetch('/api/brain', { method: 'PUT', headers: H(), body: JSON.stringify(draft()) });
  $('#status').textContent = r.ok ? 'Saved. The concierge uses this within a minute.' : `Not saved: ${await r.text()}`;
});
$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('Put every field back to the original?')) return;
  await fetch('/api/brain', { method: 'DELETE', headers: H() });
  await load(); $('#status').textContent = 'Restored.';
});
$('#tryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('#tryQ').value.trim(); if (!q) return;
  const out = $('#tryOut'); out.textContent = 'Thinking…';
  let text = '';
  try {
    const r = await fetch(`/api/concierge?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { ...H(), 'x-demo': 'amelia-preview-2026' },
      body: JSON.stringify({ messages: [{ role: 'user', content: q }], session: 'brain-try', brainDraft: draft() }) });
    const rd = r.body.getReader(), dec = new TextDecoder();
    while (true) { const { value, done } = await rd.read(); if (done) break; text += dec.decode(value, { stream: true }); out.textContent = splitChips(text).body; }
  } catch { out.textContent = 'Could not reach the concierge.'; }
});

/* Gate last, after every helper above exists — calling load() from the
 * top of the module tripped the temporal dead zone on the constants below. */
key = new URLSearchParams(location.search).get('key');
if (!key) { $('#gate').hidden = false; }
else { $('#gate').remove(); $('#own').hidden = false; $('#backLink').href = `/kelly.html?key=${encodeURIComponent(key)}`; load(); }
