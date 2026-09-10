/* Concierge chat, ⌘K palette, FAB. Everything else hooks in through the lla:* events. */
import { $, $$, reduce, sessionId, emit } from './core.js';

export const turns = [];
let ctl = null, busy = false, replies = 0;
const log = $('#log'), input = $('#chatInput'), sendBtn = $('#sendBtn'), stopBtn = $('#stopBtn'), chatEl = $('#chat'), status = $('#chatStatus');

export function add(cls, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
function setBusy(b) { busy = b; chatEl.classList.toggle('busy', b); sendBtn.disabled = b; input.disabled = b; }
function offline() { status.innerHTML = '<i style="background:#B8AC9A"></i>Offline'; }

export function splitChips(text) {
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

/* The full conversation as plain text — used by the contact form, the handoff card and sharing. */
export function transcriptText(max = 4000) {
  return turns.map(t => `${t.role === 'user' ? 'You' : 'Concierge'}: ${t.content}`).join('\n\n').slice(0, max);
}

export async function ask(q) {
  q = (q || '').trim(); if (!q || busy) return;
  emit('lla:ask', { q });
  $$('.chips', log).forEach(c => c.remove());
  add('u', q); turns.push({ role: 'user', content: q });
  if (turns.length > 16) turns.splice(0, turns.length - 16);
  const bubble = add('k think', 'Thinking'); setBusy(true); ctl = new AbortController();
  let text = '';
  try {
    const r = await fetch('/api/concierge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: turns, session: sessionId() }), signal: ctl.signal });
    if (r.status === 429) throw { code: 'rate' }; if (r.status === 503) throw { code: 'off' }; if (!r.ok) throw { code: 'up' };
    const reader = r.body.getReader(), dec = new TextDecoder();
    while (true) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); bubble.classList.remove('think'); bubble.textContent = splitChips(text).body; log.scrollTop = log.scrollHeight; }
    if (!text.trim()) throw { code: 'up' };
    const { body, chips } = splitChips(text);
    bubble.textContent = body; turns.push({ role: 'assistant', content: body }); renderChips(chips);
    const ctx = $('#ctxField'); if (ctx) ctx.value = transcriptText(4000);
    emit('lla:reply', { body, chips, index: ++replies });
  } catch (e) {
    bubble.classList.remove('think');
    if (e.name === 'AbortError') { const b = splitChips(text).body; if (b) { bubble.textContent = b; turns.push({ role: 'assistant', content: b }); } else { bubble.textContent = '(stopped)'; turns.pop(); } }
    else if (e.code === 'rate') { bubble.textContent = 'The concierge is catching its breath — try again in a moment.'; turns.pop(); }
    else if (e.code === 'off') { bubble.textContent = "The concierge is offline right now. Kelly's a text away: 512-578-9942."; turns.pop(); offline(); }
    else { bubble.textContent = splitChips(text).body || 'Connection hiccup. Try that again?'; turns.pop(); }
  } finally { setBusy(false); input.focus({ preventScroll: true }); }
}

export function goAsk(q) { $('#concierge').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); setTimeout(() => ask(q), 450); }

$('#chatForm').addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
stopBtn.addEventListener('click', () => { emit('lla:stop', {}); ctl && ctl.abort(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (!b) return; e.preventDefault(); goAsk(b.dataset.ask); });
$('#fab').addEventListener('click', () => { $('#concierge').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => input.focus(), 600); });

/* ---------- ⌘K palette ---------- */
(function () {
  const pal = $('#pal'), pin = $('#palInput'), sug = $('#palSug'); if (!pal) return;
  const S = [
    ['Where should a family from up north look?', 'Relocate'], ['Plantation vs. Historic District?', 'Compare'], ['How does Kelly price a listing?', 'Sell'], ['What does flood insurance look like here?', 'Buy'], ['Is Crane Island worth a look?', 'New build'],
  ];
  let sel = -1;
  function render(q) {
    const list = q ? [[q, 'Ask']] : S;
    sug.innerHTML = list.map(s => `<button type="button" data-q="${s[0].replace(/"/g, '&quot;')}"><span>${s[0]}</span><span>${s[1]}</span></button>`).join('');
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
