# Love. Live. Amelia. — Kelly Voges

Static site + three Netlify Functions. No build step: Netlify publishes `public/` as-is. Seamark build.

```
public/index.html          markup, SEO head, JSON-LD, hidden Netlify forms
public/styles.css          all styling (design tokens + preloader stay inline in <head>)
public/js/                 ES modules, entry point js/main.js
public/js/gl/              the effect layer: ticker, shaders, scheduler, solar math
public/js/gl/views/        one file per effect (seam, water, scene, caustics, fluid)
public/kelly.jpg           headshot          public/og.png   social card (generated)
public/sitemap.xml  public/robots.txt

src/brief.mjs              concierge prompt, relocation + listing-story prompts, area list (server-only)
src/lib.mjs                rate limiter, streaming helper, Blobs transcript logging
netlify/functions/concierge  POST /api/concierge — streaming chat & relocation brief
netlify/functions/story      POST /api/story     — streaming listing story (sellers)
netlify/functions/match      POST /api/match     — neighborhood quiz → JSON

scripts/og.mjs             regenerates public/og.png with Playwright
scripts/check.mjs          Playwright smoke test across viewports, themes and motion settings
```

### The modules

| Module | What it owns |
|---|---|
| `core.js` | selectors, motion/pointer flags, escaping, session id, reveal-on-scroll, shared button groups |
| `data.js` | neighborhoods and their compare scores, listings, price bands, the island book |
| `preloader.js` `hero.js` | tide curtain (once per session), WebGL sea, intro timeline |
| `motion.js` `map.js` `listings.js` | nav, split text, counters, pinned reel, testimonials, island map, listing cards |
| `concierge.js` | chat, ⌘K palette, FAB. Emits `lla:ask` / `lla:reply` / `lla:stop` — everything else hooks in there |
| `voice.js` `leads.js` | mic + read-aloud; in-chat handoff card, sharing, `postNetlifyForm()` |
| `match.js` `value.js` `afford.js` `compare.js` `book.js` | quiz, relocation brief, seller stepper, affordability, compare, island book |
| `polish.js` | custom cursor, magnetic buttons, signature draw-on, ocean ambience |
| `atmosphere.js` | mounts the effect layer and every view; the one place to disable all of it |
| `gl/ticker.js` | the page's single frame loop, wrapping `gsap.ticker` when it is there |
| `gl/sun.js` | solar and lunar position, computed locally — no API, no key |
| `gl/tier.js` | capability probe and the frame-cost governor |
| `gl/layer.js` `gl/sched.js` | shared canvas with scissored views; three-phase scheduler |

### The effect layer

Everything below is decoration sitting on top of a page that already works.
If the tier probe says no, a context fails, or a shader will not compile, the
site is exactly what it was without any of it.

**Tiers.** 0 is reduced motion, no WebGL, or a device that struggled: nothing
runs. 1 is the hero, the island water and the seams. 2 adds caustics and the
fluid. The governor only ever demotes — a device that struggled once will
struggle again, and promoting back reads as flickering.

**Contexts.** Four at most: the hero, one shared overlay, the island water,
and the fluid. A context per effect would need about twenty, and browsers
force-lose the oldest well before that, so the failure would be intermittent
black rectangles rather than anything diagnosable. The eleven generated
scenes use no live context at all — one transient context draws them at load
and is released.

**The sky is real.** Sun and moon come from the Astronomical Almanac series
with Bennett refraction, checked against NOAA: sunrise within a minute, the
equinox within an hour, azimuth exactly due south at local noon. Longitude
comes from the visitor's own timezone rather than the island's, so a visitor
in London at 3pm sees an afternoon rather than a black midnight hero, while
declination still comes from the real date and the seasons stay true.

**Tuning needs eyes.** Several problems here were invisible in code and
obvious in a screenshot: sections that declare no background compute to
transparent black and painted a hard black bar; the island water at full
opacity turned elegant line art into mud; the fluid's first tuning read as a
lava lamp. `scripts/.out/` holds the throwaway screenshot harness used for
that. Look at changes to any of this before trusting them.

## Run
```
npm i
cp .env.example .env   # add ANTHROPIC_API_KEY
npx netlify dev        # http://localhost:8888
npm run check          # Playwright smoke test (mocks the AI endpoints; no key needed)
                       # includes one pass reporting capable hardware, so the
                       # tier-2 effects actually execute rather than being skipped
npm run og             # regenerate public/og.png
```

## Deploy
```
npx netlify login && npx netlify init      # or link existing site
npx netlify env:set ANTHROPIC_API_KEY sk-ant-...
npm run deploy
```

## Forms — do this before launch
Three Netlify Forms ship with the site. **Enable form detection in Site settings → Forms before the first deploy**, then turn on notifications so Kelly gets an email per submission.

| Form | Where it fires | Carries |
|---|---|---|
| `contact` | the contact section | name, email, phone, interest, message, plus the concierge conversation so far |
| `concierge-lead` | the handoff card inside the chat | name, phone/email, the full transcript |
| `valuation` | the seller stepper | every answer plus the generated listing story |

The two AJAX forms post to `/` as url-encoded bodies. Their hidden static twins in `index.html` are what Netlify's build-time parser detects — **if you add a field to a form, add it to the hidden twin too** or it will be dropped silently. `netlify dev` does not accept form POSTs; test these on a Deploy Preview.

## Transcripts
Every concierge turn, relocation brief and listing story is written to the `transcripts` Netlify Blobs store, keyed by a per-visit session id. Reading them:
```
npx netlify blobs:list transcripts
npx netlify blobs:get transcripts <session>/chat.json
```
No IP is stored — just a salted 12-character hash (set `IP_SALT` to rotate it). There is deliberately no web endpoint for reading transcripts, since the site has no authentication. Leads with contact details are in Netlify Forms, not here.

## Features that talk to the functions
- **Concierge chat** — streams; server appends `§§ [...]` follow-up chips which the client parses off. Voice input (Chrome, Edge, Safari; needs HTTPS) and read-aloud are both opt-in and disappear where unsupported.
- **⌘K / Ctrl+K palette** anywhere on the page → same endpoint.
- **Handoff card** appears after the second answer, once per session, and sends the transcript to Kelly.
- **Neighborhood match** → `/api/match`, lights the matched spot on the island map.
- **Relocation brief** → `/api/concierge` with `mode: "relocate"`.
- **Listing story** (sellers) → `/api/story`. The lead is sent whether or not the story drafts, so a backend outage never costs Kelly a seller.
- **Affordability slider** and **neighborhood compare** are pure client-side; both hand off to the concierge with a pre-written question.

Everything degrades: no GSAP (CDN blocked) → static reveals; no WebGL → flat hero; reduced motion → no preloader, no cursor, no grain animation; no speech APIs → those buttons remove themselves; backend down → the chat says so and points at Kelly's phone.

## Cost
Haiku, ~700 output tokens/turn: roughly $0.002–0.005 per concierge turn; a listing story is ~900 tokens. 1,000 conversations/mo ≈ $10–25. Per-IP limiter is 20 req/min per function instance (10 for `/api/story`); move to Upstash if it gets hammered.

## Kelly needs to confirm before launch
- [ ] **Island Book** — every beach, restaurant and event in `public/js/data.js` (`BOOK`). These are placeholders from public knowledge; Kelly's real list is better and it should be hers.
- [ ] **Compare scores** — the 1–5 attribute scores per neighborhood in `data.js` (`PLACES[…].s`). They're one agent's read, and they're visible to buyers.
- [ ] **Domain** — `loveliveamelia.com` is hard-coded in the canonical tag, JSON-LD, sitemap and OG tags, and currently forwards to BoldTrail.
- [ ] Email address and Facebook URL; the Zillow review count in the JSON-LD (`aggregateRating`).

## TODO
- [ ] Real listings: BoldTrail IDX embed or IDX Broker API into `#listingGrid` (see `LISTINGS` in `data.js`)
- [ ] Real photography (hero, communities, listings)
- [ ] Plausible/GA
- [ ] DNS: loveliveamelia.com → Netlify
