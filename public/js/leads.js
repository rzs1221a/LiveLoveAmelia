/* Turning a conversation into a lead Kelly actually receives. */
import { $, $$, sessionId, store } from './core.js';
import { transcriptText } from './concierge.js';

/* Netlify Forms over fetch — the matching hidden forms live in index.html. */
export async function postNetlifyForm(name, fields) {
  const body = new URLSearchParams({ 'form-name': name, ...fields });
  try {
    const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    return r.ok;
  } catch { return false; }
}

const log = $('#log');

export function showHandoff(force) {
  if (!log) return;
  if (!force && store.ses('lla:handoff')) return;
  if ($('.msg.handoff', log)) { $('.msg.handoff', log).scrollIntoView({ block: 'nearest' }); return; }
  store.sesSet('lla:handoff', '1');
  const card = document.createElement('div');
  card.className = 'msg k handoff';
  card.innerHTML = `<b>Want Kelly to pick this up personally?</b>
    <p>She'll read this conversation before she calls, so you won't start over.</p>
    <input id="hoName" type="text" placeholder="Your name" autocomplete="name" aria-label="Your name">
    <input id="hoContact" type="text" placeholder="Phone or email" autocomplete="tel email" aria-label="Phone or email">
    <button type="button" id="hoSend">Have Kelly reach out <span class="arr">→</span></button>
    <small>By sending, you agree to be contacted by Kelly Voges / BHHS Heymann Williams Realty.</small>`;
  log.appendChild(card); log.scrollTop = log.scrollHeight;

  const btn = $('#hoSend', card);
  btn.addEventListener('click', async () => {
    const name = $('#hoName', card).value.trim();
    const contact = $('#hoContact', card).value.trim();
    if (!/@|\d{7,}/.test(contact)) { $('#hoContact', card).focus(); card.classList.add('err'); return; }
    card.classList.remove('err'); btn.disabled = true; btn.textContent = 'Sending…';
    const ok = await postNetlifyForm('concierge-lead', {
      name, contact, transcript: transcriptText(6000), session: sessionId(), page: location.href,
    });
    card.innerHTML = ok
      ? `<b>Got it — Kelly will reach out.</b><p>Usually the same day. Keep asking in the meantime.</p>`
      : `<b>That didn't send.</b><p>Text Kelly directly and she'll pick it up: <a href="sms:15125789942">512-578-9942</a>.</p>`;
    log.scrollTop = log.scrollHeight;
  });
}

/* Offer the handoff once the conversation has real substance. */
document.addEventListener('lla:reply', e => {
  if (e.detail.index === 2) showHandoff(false);
  const share = $('#shareBtn'), toKelly = $('#toKellyBtn');
  if (share) share.hidden = false;
  if (toKelly) toKelly.hidden = false;
});

$('#toKellyBtn')?.addEventListener('click', () => showHandoff(true));

/* Take the conversation with you. */
$('#shareBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  const text = `Kelly's Island Concierge — Amelia Island\n\n${transcriptText(1600)}\n\nKelly Voges · 512-578-9942 · ${location.origin}`;
  const flash = msg => { const old = btn.textContent; btn.textContent = msg; setTimeout(() => btn.textContent = old, 1800); };
  if (navigator.share) { try { await navigator.share({ title: "Kelly's Island Concierge", text }); return; } catch { /* dismissed */ } }
  if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); flash('Copied ✓'); return; } catch {} }
  location.href = `mailto:?subject=${encodeURIComponent('Amelia Island — concierge chat')}&body=${encodeURIComponent(text.slice(0, 1800))}`;
});
