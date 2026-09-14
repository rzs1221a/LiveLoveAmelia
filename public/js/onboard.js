/* The welcome screen: one question, once, on the first visit.
 *
 * "What brings you to Amelia?" — the answer takes the visitor to the right
 * part of the page and tunes the concierge's opening line and starter
 * questions to it. The choice is remembered, so the screen never shows twice;
 * `?welcome` on the URL brings it back for a demo. The head script that shows
 * it also removes it after a few seconds if this module never arrives, so a
 * failed script can never leave a visitor staring at a locked page. */
import { $, $$, reduce, hasGsap, store, track } from './core.js';

window.__onboard = true;

let resolveDone;
export const onboardDone = new Promise(r => (resolveDone = r));

const MODES = {
  buying: {
    go: '#island',
    hello: "So you're buying on Amelia Island. Tell me what you're after. A beach house, a walkable block downtown, more room in Yulee. I'll point you at the right end of the island, and Kelly calls you back herself.",
    starters: [
      ["Plantation vs. Crane Island vs. Historic District?", "What's the difference between Amelia Island Plantation, Crane Island, and the Historic District?"],
      ["What do homes near the beach cost right now?", "What do homes near the beach on Amelia Island cost right now, and where is the value?"],
      ["Flood zones and insurance — what should I know?", "What should I know about flood zones and flood insurance when buying on Amelia Island?"],
      ["Buying a second home or vacation rental here", "What should I know about buying a second home or vacation rental on Amelia Island?"],
    ],
  },
  selling: {
    go: '#value',
    hello: "Thinking of selling? Ask me how Kelly prepares, prices and positions a home here. Or use the seller tool on this page and I'll write a listing story for your house.",
    starters: [
      ["How does Kelly get a home sold in 30 days?", "I'm thinking of selling my home in Fernandina Beach. How does Kelly prepare and position a listing?"],
      ["What should I do before I list?", "What should I do to prepare my Amelia Island home before listing it?"],
      ["How does Kelly price a home in this market?", "How does Kelly decide on a list price in the current Amelia Island market?"],
      ["What do the first two weeks on the market look like?", "What do the first two weeks on the market look like when Kelly lists a home?"],
    ],
  },
  relocating: {
    go: '#relocate',
    hello: "Moving to Northeast Florida? Kelly did it too, from Boston. Tell me where you're coming from and who's coming with you, and I'll sketch what life here looks like. Or fill in the relocation brief on this page and I'll write it out.",
    starters: [
      ["Relocating with kids and a dog — where should we look?", "We're relocating from up north with two kids and a dog. Where on Amelia Island should we be looking?"],
      ["What are the schools like in Nassau County?", "What are the schools like on Amelia Island and in Nassau County?"],
      ["What does a move from up north really cost?", "What does a move from the Northeast to Amelia Island really cost, all in?"],
      ["How far is the airport, and what's the commute like?", "How far is Amelia Island from the Jacksonville airport, and what is commuting like?"],
    ],
  },
  browsing: { go: null },
};

function personalize(mode) {
  const m = MODES[mode]; if (!m || !m.hello) return;
  const first = $('#log .msg.k'); if (first) first.textContent = m.hello;
  const starters = $('#starters');
  if (starters) starters.innerHTML = m.starters.map(([label, q]) =>
    `<button type="button" data-ask="${q.replace(/"/g, '&quot;')}"><span>${label}</span><span>→</span></button>`).join('');
}

(function () {
  const el = $('#welcome');
  const html = document.documentElement;
  const showing = !!el && html.classList.contains('onboard');
  let done = false;

  function finish(mode) {
    if (done) return; done = true;
    store.set('lla:onboard', mode);
    track('onboard', { mode });
    personalize(mode);
    const target = MODES[mode]?.go && $(MODES[mode].go);
    const lift = () => { html.classList.remove('onboard'); el.remove(); resolveDone(); };
    if (!hasGsap || reduce) {
      lift();
      if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
      return;
    }
    el.classList.add('out');
    setTimeout(() => {
      lift();
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 480);
  }

  if (!showing) {
    /* A returning visitor keeps the tuned concierge from their first choice. */
    personalize(store.get('lla:onboard'));
    el?.remove(); html.classList.remove('onboard'); resolveDone();
    return;
  }

  $$('button[data-mode]', el).forEach(b => b.addEventListener('click', () => finish(b.dataset.mode)));
  $('#welcomeSkip')?.addEventListener('click', e => { e.preventDefault(); finish('browsing'); });
  addEventListener('keydown', e => { if (e.key === 'Escape') finish('browsing'); });
  setTimeout(() => $('button[data-mode]', el)?.focus({ preventScroll: true }), 50);
})();
