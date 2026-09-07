# Love. Live. Amelia. — Kelly Voges

Static site + two Netlify Functions. Seamark build.

```
public/index.html            markup + CSS
public/app.js                shader hero, GSAP choreography, island map, ⌘K palette, concierge, match, relocation brief
public/kelly.jpg             headshot
src/brief.mjs                concierge system prompt + area list (server-only)
netlify/functions/concierge  POST /api/concierge — streaming chat
netlify/functions/match      POST /api/match — neighborhood quiz → JSON
```

## Run
```
npm i
cp .env.example .env   # add ANTHROPIC_API_KEY
npx netlify dev        # http://localhost:8888
```

## Deploy
```
npx netlify login && npx netlify init      # or link existing site
npx netlify env:set ANTHROPIC_API_KEY sk-ant-...
npm run deploy
```
Contact form uses Netlify Forms (`data-netlify="true"`) — enable notifications in Site settings → Forms.

## Features that talk to the functions
- Concierge chat (streams; server appends `§§ [...]` follow-up chips which the client parses off)
- ⌘K / Ctrl+K palette anywhere on the page → same endpoint
- Neighborhood match → `/api/match`, lights the matched spot on the island map
- Relocation brief → `/api/concierge` with `mode: "relocate"`
- Contact form carries the last 6 concierge turns in a hidden `concierge_context` field so Kelly sees what they asked

GSAP loads from cdnjs; the page degrades to static reveals if it's blocked.

## Cost
Haiku, ~700 output tokens/turn: roughly $0.002–0.005 per concierge turn. 1,000 conversations/mo ≈ $10–25. Per-IP limiter is 20 req/min per function instance; move to Upstash if it gets hammered.

## TODO
- [ ] Real listings: BoldTrail IDX embed or IDX Broker API into `#listingGrid` (see `LISTINGS` array)
- [ ] Real photography (hero, communities, listings)
- [ ] Confirm Kelly's email; Facebook URL
- [ ] OG image + meta description
- [ ] Plausible/GA
- [ ] Log concierge transcripts → lead capture (Netlify Blobs or Sheets)
- [ ] DNS: loveliveamelia.com → Netlify (currently forwards to BoldTrail)
