/* The tour: Kelly's walk through her own website, one stop at a time.
 *
 * Fourteen stops. Each one scrolls to a part of the page, rings it, and says
 * what it does for her in a few lines. The page stays live underneath, so she
 * can tap the map or ask the concierge mid-tour. Seen once, it is remembered
 * (localStorage `lla:toured`); `/?tour` replays it. The head script that
 * opens it also closes it after five seconds if this module never arrives. */
import { $, $$, reduce, store, track } from './core.js';

window.__tour = true;

const STOPS = [
  { title: 'Welcome, Kelly.',
    body: 'This is your website. Fourteen stops, about two minutes. First the page as a buyer sees it, then the part only you see. Tap the map, try the chat; nothing here bites.' },
  { at: '.hero .wrap > div:first-child', title: 'Your name, your face, your line.',
    body: 'Love. Live. Amelia. over a live ocean. The two buttons go where a visitor is most likely headed: the concierge and the homes.' },
  { at: '.rail', title: 'Your numbers.',
    body: 'Eighteen years, a 5.0 on Zillow, thirty-plus homes sold. They count up as the page loads.' },
  { at: '.meet .sticky', title: 'Meet Kelly, in your words.',
    body: 'Your bio, your credentials, your license. Want a word changed? Say which one.' },
  { at: '#map', title: 'Seven neighborhoods.', light: 'crane',
    body: 'Tap a point and the card fills in. Every card ends with a question for the concierge. Crane Island is lit right now.' },
  { at: '.reel .head', block: 'start', title: 'Five communities.',
    body: 'Scroll sideways. Each card asks the concierge a question on the visitor\'s behalf, so nobody has to think of what to type.' },
  { at: '#listingGrid', title: 'Homes on the market.',
    body: 'Six sample homes until your MLS feed is connected. Then these are your live listings, and each one can be asked about.' },
  { at: '#chat', title: 'The concierge.',
    body: 'It knows the island the way you do and answers at three in the morning. After the second answer it asks for a name and a number, and the whole conversation lands in your inbox. Try a starter question.' },
  { at: '#quiz', title: 'Find your fit.',
    body: 'Four taps. The concierge names a neighborhood, says why, and lights it up on the map above.' },
  { at: '#reloForm', title: 'The relocation brief.',
    body: 'For the Boston call. A visitor says where they are coming from and gets the brief you would walk them through, before you pick up the phone.' },
  { at: '#valForm', title: 'Sellers.',
    body: 'Three short steps and the concierge writes a listing story for their house. Their name and number reach you whether or not the story drafts.' },
  { at: '#stage', title: 'Your reviews.',
    body: 'Your Zillow reviews, rotating. Fawn, Greg, Jenn, the Oglesbys and Peter, in their own words.' },
  { at: '.contact .form', title: 'Contact.',
    body: 'The form emails you. If the visitor was talking to the concierge, that conversation rides along with the message.' },
  { title: 'Your page.',
    body: 'Everything a visitor does lands on a page only you can open: the leads, the transcripts, the numbers, and the brain, where you edit what the concierge knows. It is the link you were sent. Replay this tour any time from there.' },
];

(function () {
  const el = $('#tour'), html = document.documentElement;
  if (!el) return;
  if (!html.classList.contains('touring')) { el.remove(); return; }

  const ring = $('.tour-ring', el), dim = $('.tour-dim', el);
  const title = $('#tourTitle'), body = $('#tourBody'), stepEl = $('#tourStep');
  const back = $('#tourBack'), next = $('#tourNext'), skip = $('#tourSkip');
  let i = 0, target = null, raf = 0, done = false;

  /* The ring is fixed and follows its target on every scroll frame; its
   * shadow is what dims the rest of the page, so the page itself stays live. */
  function place() {
    raf = 0;
    if (!target) { ring.hidden = true; return; }
    const r = target.getBoundingClientRect(), pad = innerWidth < 640 ? 6 : 12;
    ring.hidden = false;
    ring.style.top = (r.top - pad) + 'px'; ring.style.left = (r.left - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
    /* The card sits in whichever bottom corner the target is not in. */
    el.classList.toggle('side-left', (r.left + r.width / 2) > innerWidth / 2);
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });

  function show(n) {
    i = Math.max(0, Math.min(STOPS.length - 1, n));
    const s = STOPS[i];
    stepEl.textContent = (i + 1) + ' / ' + STOPS.length;
    title.textContent = s.title; body.textContent = s.body;
    back.hidden = i === 0;
    next.innerHTML = i === STOPS.length - 1 ? 'Done' : 'Next <span class="arr">→</span>';
    target = s.at ? $(s.at) : null;
    el.classList.toggle('centered', !target);
    dim.hidden = !!target;
    ring.classList.add('moving');
    if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: s.block || 'center' });
    else scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (s.light) $('.map .spot[data-id="' + s.light + '"]')?.dispatchEvent(new Event('click'));
    place();
    setTimeout(() => { ring.classList.remove('moving'); place(); }, reduce ? 50 : 750);
    next.focus({ preventScroll: true });
    track('tour', { stop: i });
  }

  function finish() {
    if (done) return; done = true;
    store.set('lla:toured', '1');
    html.classList.remove('touring');
    el.remove();
  }

  next.addEventListener('click', () => (i === STOPS.length - 1 ? finish() : show(i + 1)));
  back.addEventListener('click', () => show(i - 1));
  skip.addEventListener('click', finish);
  addEventListener('keydown', e => {
    if (done) return;
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  });
  show(0);
})();
