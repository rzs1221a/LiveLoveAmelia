/* Voice: ask out loud, hear the answer back. Both are optional and both degrade to nothing. */
import { $, store } from './core.js';
import { add } from './concierge.js';

/* ---------- Mic ---------- */
(function () {
  const btn = $('#micBtn'), input = $('#chatInput'), form = $('#chatForm'), chat = $('#chat');
  if (!btn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !window.isSecureContext) { btn.remove(); return; }
  let rec = null, listening = false, finalText = '';
  const placeholder = input.placeholder;

  function stopUI() {
    listening = false; chat.classList.remove('listening');
    btn.setAttribute('aria-pressed', 'false'); input.placeholder = placeholder;
  }
  btn.addEventListener('click', () => {
    if (listening) { rec?.stop(); return; }
    try { rec = new SR(); } catch { btn.remove(); return; }
    rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    finalText = '';
    rec.onstart = () => { listening = true; chat.classList.add('listening'); btn.setAttribute('aria-pressed', 'true'); input.placeholder = 'Listening…'; };
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      input.value = (finalText + interim).trim();
    };
    rec.onerror = ev => {
      stopUI();
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        btn.remove();
        add('sys', 'Microphone unavailable — type your question instead.');
      }
    };
    rec.onend = () => {
      stopUI();
      if (finalText.trim()) form.requestSubmit();
    };
    try { rec.start(); } catch { stopUI(); }
  });
})();

/* ---------- Read aloud ---------- */
(function () {
  const btn = $('#ttsBtn'); if (!btn) return;
  if (!('speechSynthesis' in window)) { btn.remove(); return; }
  const synth = window.speechSynthesis;
  let on = store.get('lla:tts') === '1';
  const paint = () => { btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('on', on); };
  paint();

  function voice() {
    const vs = synth.getVoices();
    return vs.find(v => /Samantha/i.test(v.name)) || vs.find(v => /Google US English/i.test(v.name)) ||
      vs.find(v => v.lang === 'en-US') || vs.find(v => v.lang?.startsWith('en')) || null;
  }
  /* Chrome truncates long utterances, so speak sentence by sentence. */
  function speak(text) {
    if (!text) return;
    synth.cancel();
    const v = voice();
    text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean).forEach(sentence => {
      const u = new SpeechSynthesisUtterance(sentence);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 1; u.pitch = 1;
      synth.speak(u);
    });
  }
  btn.addEventListener('click', () => {
    on = !on; store.set('lla:tts', on ? '1' : '0'); paint();
    if (on) speak('Read aloud is on.'); else synth.cancel();   /* inside the gesture, which iOS requires */
  });
  document.addEventListener('lla:reply', e => { if (on) speak(e.detail.body); });
  document.addEventListener('lla:ask', () => synth.cancel());
  document.addEventListener('lla:stop', () => synth.cancel());
  addEventListener('beforeunload', () => synth.cancel());
})();
