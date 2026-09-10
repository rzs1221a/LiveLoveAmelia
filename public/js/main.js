/* Entry point.
 *
 * Dynamic imports rather than a static list, because static imports are
 * instantiated as one graph: a single bad module takes down every other one,
 * including modules earlier in the list if the failure is a link error.
 *
 * Loading them strictly in sequence fixes that but creates a sixteen-deep
 * waterfall, which pushed the last modules — the atmosphere layer among them
 * — well past two seconds. So: the above-the-fold path in order, then
 * everything else at once. Nothing in the second wave depends on the order
 * of the others; each module finds its own elements and returns quietly if
 * they are not there. */
const load = m => import(m).catch(e => {
  console.error(`[lla] ${m} failed to load; the rest of the page continues`, e);
});

/* First: the hero (which pulls in core and the preloader) and the nav. */
await load('./hero.js');
await load('./motion.js');

await Promise.allSettled([
  './map.js',
  './listings.js',
  './concierge.js',
  './voice.js',
  './leads.js',
  './match.js',
  './compare.js',
  './afford.js',
  './value.js',
  './book.js',
  './polish.js',
  './atmosphere.js',
].map(load));
