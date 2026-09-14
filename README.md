# Love. Live. Amelia. — Kelly Voges

Static site + three Netlify Functions. No build step: Netlify publishes `public/` as-is. Seamark build.

```
public/index.html          markup, SEO head, JSON-LD, hidden Netlify forms, the welcome screen
public/styles.css          all styling (design tokens stay inline in <head>)
public/js/                 ES modules, entry point js/main.js
public/kelly.jpg           headshot          public/og.png   social card (generated)
public/sitemap.xml  public/robots.txt

src/brief.mjs              concierge prompt, relocation + listing-story prompts, area list (server-only)
src/lib.mjs                rate limiter, streaming helper, Blobs transcript logging
netlify/functions/concierge  POST /api/concierge — streaming chat & relocation brief
netlify/functions/story      POST /api/story     — streaming listing story (sellers)
netlify/functions/match      POST /api/match     — neighborhood quiz → JSON
netlify/functions/lead       POST /api/lead      — mirrors a captured lead into Blobs for the owner page
netlify/functions/track      POST /api/track     — first-party events (view, ask, story, match, relocate)
netlify/functions/kelly      GET  /api/kelly     — owner report: leads + stats (owner key)
netlify/functions/brain      GET/PUT/DELETE /api/brain — the editable prompt (owner key; ?public=1 → venues only)
public/kelly.html            Kelly's private page: live stats, the lead inbox, the arithmetic, a 60-second demo
public/brain.html            the concierge's brain, editable in plain forms, with a live "try it"

scripts/og.mjs             regenerates public/og.png with Playwright
scripts/check.mjs          Playwright smoke test across viewports, themes and motion settings
```

### Owner pages and the two keys

Two keys, both constants until launch, both in `src/lib.mjs`:

| Key | Unlocks | Where it goes at launch |
|---|---|---|
| `DEMO_KEY` | the paid endpoints, for a demo browser (`/?demo=<key>`, sticks in localStorage) | deleted, with `demoLocked` and its call sites |
| `OWNER_KEY` | `/kelly.html?key=…`, `/brain.html?key=…`, `/api/kelly`, `/api/brain` | `process.env.OWNER_KEY` in Netlify → Site configuration → Environment variables; the code already prefers it |

Kelly's link does both: opening `/kelly.html?key=<OWNER_KEY>` also unlocks the demo for that browser.

**How a lead reaches her.** The handoff card and the seller flow post to Netlify Forms (`concierge-lead`, `valuation`) *and* to `/api/lead`. Forms is the email; Blobs is what `/kelly.html` reads. Email notifications are dashboard-only: Netlify → Site configuration → Forms → Form notifications → Add notification → Email, one per form, to her address. Do that before the call where you want a lead to land on her phone.

**The brain.** `src/brief.mjs` is now fields plus `compose()`. Defaults ship in code; an override saved from `/brain.html` lives in the `brain` Blobs store (`current.json`, history under `history/`) and is read with a one-minute cache. `compose(DEFAULTS)` equals the prompt that used to be one string, byte for byte. Two fields are locked (Fair Housing, no invented numbers) and always come from code.

**Launch-day checklist**, one commit: remove `DEMO_KEY`/`demoLocked` and the `x-demo` client headers; move `OWNER_KEY` to an env var; drop `X-Robots-Tag` from `netlify.toml`; restore `public/robots.txt`; set the fee constant in `public/js/kelly.js` if a monthly figure is agreed.

### The modules

| Module | What it owns |
|---|---|
| `core.js` | selectors, motion/pointer flags, escaping, session id, reveal-on-scroll, shared button groups |
| `data.js` | neighborhoods, listings |
| `onboard.js` | the welcome screen: one question on the first visit, remembered in localStorage |
| `hero.js` | intro timeline and the portrait parallax; the sea behind it is a CSS gradient |
| `motion.js` `map.js` `listings.js` | nav, split text, counters, pinned reel, testimonials, island map, listing cards |
| `concierge.js` | chat and the FAB. Emits `lla:ask` / `lla:reply` / `lla:stop`; everything else hooks in there |
| `voice.js` `leads.js` | mic + read-aloud; in-chat handoff card, sharing, `postNetlifyForm()` |
| `match.js` `value.js` | quiz, relocation brief, seller stepper |

### The welcome screen

The first visit opens on one question: buying, selling, relocating, or just
looking. The answer scrolls the visitor to the matching section, swaps the
concierge's opening line and its four starter questions, and is stored in
localStorage under `lla:onboard`, so the screen shows once. `/?welcome`
brings it back for a demo. The head script that shows it also lifts it after
five seconds if `onboard.js` never arrives, so a failed module cannot lock
the page. Escape and the skip link both count as "just looking".

### What came out

The WebGL sky, seams, island water, generated scenes, the custom cursor, the
film grain, the tide curtain, the ocean sound, the ⌘K palette, and the
affordability, compare and island-book sections. The page under all of it is
what ships now. `git log` has every one of them if any is wanted back.

## Run
```
npm i
cp .env.example .env   # add ANTHROPIC_API_KEY
npx netlify dev        # http://localhost:8888
npm run check          # Playwright smoke test (mocks the AI endpoints; no key needed)
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

Everything degrades: no GSAP (CDN blocked) → static reveals and an instant welcome dismiss; reduced motion → no intro, no parallax; no speech APIs → those buttons remove themselves; backend down → the chat says so and points at Kelly's phone.

## Cost
Haiku, ~700 output tokens/turn: roughly $0.002–0.005 per concierge turn; a listing story is ~900 tokens. 1,000 conversations/mo ≈ $10–25. Per-IP limiter is 20 req/min per function instance (10 for `/api/story`); move to Upstash if it gets hammered.

## Kelly needs to confirm before launch
- [ ] **Venues** — the places the concierge recommends live in the brain (`/brain.html`). Drafted from public knowledge; Kelly's list should replace it.
- [ ] **Domain** — `loveliveamelia.com` is hard-coded in the canonical tag, JSON-LD, sitemap and OG tags, and currently forwards to BoldTrail.
- [ ] Email address and Facebook URL; the Zillow review count in the JSON-LD (`aggregateRating`).

## TODO
- [ ] Real listings: BoldTrail IDX embed or IDX Broker API into `#listingGrid` (see `LISTINGS` in `data.js`)
- [ ] Real photography (hero, communities, listings)
- [ ] Plausible/GA
- [ ] DNS: loveliveamelia.com → Netlify
