/* Entry point.
 *
 * Dynamic imports rather than a static list, because static imports are
 * instantiated as one graph: a single bad module takes down every other one,
 * including modules earlier in the list if the failure is a link error.
 * The above-the-fold path loads in order, then everything else at once; each
 * module finds its own elements and returns quietly if they are not there. */
const load = m => import(m).catch(e => {
  console.error(`[lla] ${m} failed to load; the rest of the page continues`, e);
});

/* First: the hero (which pulls in core), then the nav. */
await load('./hero.js');
await load('./motion.js');

await Promise.allSettled([
  './map.js',
  './listings.js',
  './concierge.js',
  './voice.js',
  './leads.js',
  './match.js',
  './value.js',
  './tour.js',
].map(load));
