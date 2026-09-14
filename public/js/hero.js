/* Hero: the intro and a little parallax on the portrait. The sea behind it is CSS. */
import { $$, reduce, hasGsap } from './core.js';
/* Waits on the welcome screen when there is one; a missing module must not
 * take the hero down with it. */
const { onboardDone } = await import('./onboard.js').catch(() => ({ onboardDone: Promise.resolve() }));

(function () {
  const lines = $$('.hero h1 .l span');
  if (!hasGsap || reduce) { lines.forEach(s => s.style.transform = 'none'); return; }
  const tl = gsap.timeline({ paused: true });
  tl.to(lines, { y: 0, duration: 1.1, stagger: .12, ease: 'power4.out' }, 0.1)
    .from('.hero .eyebrow, .hero .sub, .hero .cta', { opacity: 0, y: 18, duration: .8, stagger: .1, ease: 'power3.out' }, '-=.7')
    .from('#portrait', { opacity: 0, y: 40, duration: 1.2, ease: 'power3.out' }, '-=.9');
  /* The welcome screen, when it shows, gets the first moment; the hero plays as it lifts. */
  onboardDone.then(() => tl.play());
  gsap.to('#portrait', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
})();
