// Playwright smoke test. Serves public/ statically, mocks the AI endpoints and the
// Netlify Forms POST, then drives the tour, the hero ocean, the concierge, the
// seller flow and the owner pages across viewports, themes and motion settings.
// Run: npm run check   (screenshots land in scripts/.out)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "public");
const out = resolve(here, ".out");
mkdirSync(out, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".xml": "application/xml", ".txt": "text/plain" };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = join(root, url.pathname === "/" ? "index.html" : url.pathname);
    const body = await readFile(p);
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nope"); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const CHAT = `Amelia Island splits into a few distinct worlds. The Historic District is walkable and Victorian; the Plantation is gated and green.

Kelly would start by asking what your Saturday looks like. Give her a call or text at 512-578-9942.
§§ ["What about flood insurance?","How far is the airport?","Can Kelly show me Crane Island?"]`;
const STORY = `THE POSITIONING
A light-filled coastal home minutes from the sand, led by its porch and its lot.

STAGING PRIORITIES
Clear the entry, refresh the mulch, and let every window earn its view.

THE BUYER
Someone trading a long commute for a short walk to the water.

LAUNCH PLAN
Photography first, then a launch weekend with private showings.

Kelly will bring the comparable sales — reach her at 512-578-9942.`;

/* GSAP normally comes from cdnjs, which the page can't reach inside a test.
   Cache it once so the animated paths get real coverage; if the network is
   unavailable, the run still proceeds against the no-GSAP fallback. */
const vendor = resolve(out, "vendor");
mkdirSync(vendor, { recursive: true });
let gsapReady = true;
for (const f of ["gsap.min.js", "ScrollTrigger.min.js"]) {
  const dest = resolve(vendor, f);
  if (existsSync(dest)) continue;
  try {
    const r = await fetch(`https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/${f}`);
    if (!r.ok) throw new Error(String(r.status));
    await writeFile(dest, await r.text());
  } catch (e) {
    console.warn(`could not cache ${f} (${e.message}) — testing the no-GSAP fallback instead`);
    gsapReady = false;
  }
}

const failures = [];
const browser = await chromium.launch();

for (const vp of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 400, height: 800 }]) {
  for (const motion of ["no-preference", "reduce"]) {
    for (const scheme of ["light", "dark"]) {
      const label = `${vp.name}/${motion}/${scheme}`;
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: motion === "reduce" ? "reduce" : "no-preference",
        colorScheme: scheme,
      });
      const page = await ctx.newPage();
      const errs = [];
      const IGNORE = /Failed to load resource|net::ERR_|ERR_CONNECTION/;
      page.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errs.push(m.text()); });
      page.on("pageerror", (e) => errs.push("pageerror: " + e.message));

      const posts = [];
      // GSAP and Google Fonts are unreachable in the sandbox; serve GSAP from a local copy
      // so the animated code paths get real coverage, and let fonts fail harmlessly.
      if (gsapReady) {
      await page.route("**/cdnjs.cloudflare.com/**/gsap.min.js", async (r) =>
        r.fulfill({ contentType: "text/javascript", body: await readFile(resolve(here, ".out/vendor/gsap.min.js"), "utf8") }));
      await page.route("**/cdnjs.cloudflare.com/**/ScrollTrigger.min.js", async (r) =>
        r.fulfill({ contentType: "text/javascript", body: await readFile(resolve(here, ".out/vendor/ScrollTrigger.min.js"), "utf8") }));
      }
      await page.route("**/fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "" }));
      await page.route("**/api/concierge", (r) => r.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: CHAT }));
      await page.route("**/api/story", (r) => r.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: STORY }));
      await page.route("**/api/match", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ area: "Yulee", tagline: "More house, same island weekends", why: "You want space.", runnerUp: "Crane Island", runnerUpWhy: "Newer, closer in." }) }));
      await page.route(base + "/", (r) => {
        if (r.request().method() === "POST") { posts.push(r.request().postData() || ""); return r.fulfill({ status: 200, body: "ok" }); }
        return r.continue();
      });

      const t = (name, cond) => { if (!cond) failures.push(`${label}: ${name}`); };

      // Count every WebGL context the page asks for: the hero ocean is the only one.
      await page.addInitScript(() => {
        window.__glContexts = 0;
        const orig = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          const c = orig.call(this, type, ...rest);
          if (c && /webgl/i.test(type)) window.__glContexts++;
          return c;
        };
      });

      await page.goto(base + "/", { waitUntil: "load" });

      // First visit: the tour opens on its welcome stop, centered, over a dimmed
      // page. Next walks the stops; each rings its target and scrolls to it.
      await page.waitForFunction(() => window.__tour, null, { timeout: 5000 }).catch(() => {});
      t("tour opens on first visit", await page.evaluate(() => document.documentElement.classList.contains("touring") && getComputedStyle(document.querySelector("#tour")).display !== "none"));
      t("tour starts centered", await page.evaluate(() => document.querySelector("#tour").classList.contains("centered") && document.querySelector("#tourBack").hidden));
      t("tour counts fourteen stops", (await page.locator("#tourStep").innerText()) === "1 / 14");
      await page.click("#tourNext");
      await page.waitForTimeout(motion === "reduce" ? 150 : 900);
      t("second stop rings the hero", await page.evaluate(() => { const r = document.querySelector(".tour-ring"); if (r.hidden) return false; const b = r.getBoundingClientRect(), h = document.querySelector(".hero .wrap > div").getBoundingClientRect(); return Math.abs(b.top - h.top) < 40 && b.width > h.width - 4; }));
      for (let k = 0; k < 3; k++) { await page.click("#tourNext"); await page.waitForTimeout(motion === "reduce" ? 120 : 850); }
      t("map stop lights Crane Island", await page.evaluate(() => document.querySelector('.map .spot[data-id="crane"]').classList.contains("hot") && document.querySelector("#place h3")?.textContent.includes("Crane")));
      t("map stop scrolls the map into view", await page.evaluate(() => { const r = document.querySelector("#map").getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }));
      await page.click("#tourBack");
      await page.waitForTimeout(200);
      t("back works", (await page.locator("#tourStep").innerText()) === "4 / 14");
      await page.click("#tourSkip");
      await page.waitForFunction(() => !document.querySelector("#tour"), null, { timeout: 3000 }).catch(() => {});
      t("skip closes the tour", (await page.locator("#tour").count()) === 0 && !(await page.evaluate(() => document.documentElement.classList.contains("touring"))));
      t("tour remembered", (await page.evaluate(() => localStorage.getItem("lla:toured"))) === "1");

      // The page reads: who Kelly is, the island, the homes, then the tools.
      t("section order", (await page.evaluate(() => [...document.querySelectorAll("header[id],section[id]")].map(e => e.id).join(","))) === "top,meet,island,communities,listings,concierge,match,relocate,value,process,reviews,contact");
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(motion === "reduce" ? 100 : 1400);
      t("portrait in the hero", await page.evaluate(() => { const r = document.querySelector("#portrait img")?.getBoundingClientRect(); return !!r && r.width > 100 && r.top < innerHeight; }));
      t("hero headline visible", await page.evaluate(() => [...document.querySelectorAll(".hero h1 .l span")].every(s => { const m = new DOMMatrixReadOnly(getComputedStyle(s).transform); return Math.abs(m.f) < 2; })));
      t("nothing left of the atmosphere", (await page.locator("canvas:not(#sea), .seam, #loader, .grain, #pal, #soundBtn").count()) === 0);
      if (gsapReady) t("gsap available", await page.evaluate(() => typeof window.gsap !== "undefined"));

      // Concierge: two questions, then the handoff card.
      for (const q of ["What is the Historic District like?", "And the Plantation?"]) {
        await page.fill("#chatInput", q);
        await page.click("#sendBtn");
        await page.waitForTimeout(450);
      }
      t("chat replied", (await page.locator(".msg.k").count()) >= 3);
      t("chips rendered", (await page.locator(".chips button").count()) === 3);
      t("chips stripped from body", !(await page.locator(".msg.k").last().innerText()).includes("§§"));
      await page.waitForSelector(".msg.handoff", { timeout: 2000 }).catch(() => {});
      t("handoff card shown", await page.locator(".msg.handoff").count() === 1);
      await page.fill("#hoName", "Sam Rivers");
      await page.fill("#hoContact", "sam@example.com");
      await page.click("#hoSend");
      await page.waitForTimeout(300);
      t("handoff sent", posts.some((b) => b.includes("form-name=concierge-lead") && b.includes("transcript=")));
      t("handoff confirms", (await page.locator(".msg.handoff").innerText()).includes("Kelly will reach out"));

      // Read-aloud toggle persists.
      await page.click("#ttsBtn");
      t("tts stored", (await page.evaluate(() => localStorage.getItem("lla:tts"))) === "1");
      await page.click("#ttsBtn");

      // Seller stepper → listing story + lead.
      await page.locator("#value").scrollIntoViewIfNeeded();
      await page.selectOption("#vArea", { index: 2 });
      await page.click("#valNext");
      await page.click('#valForm .opts[data-key="type"] button:first-child');
      await page.fill("#vBeds", "4"); await page.fill("#vBaths", "3"); await page.fill("#vSqft", "2600");
      await page.click('#valForm .opts[data-key="condition"] button:first-child');
      await page.click('#valForm .opts[data-key="timeline"] button:first-child');
      await page.click("#valNext");
      await page.fill("#vName", "Dana Fields");
      await page.fill("#vEmail", "dana@example.com");
      await page.click('#valForm button[type=submit]');
      await page.waitForTimeout(700);
      t("story drafted", (await page.locator("#storyBody").innerText()).includes("THE POSITIONING"));
      t("valuation lead sent", posts.some((b) => b.includes("form-name=valuation") && b.includes("story=")));

      // Nothing rendered by JS may end up invisible (a .rv.pre left un-cleared,
      // or a gsap.from() that captured the pre-reveal opacity as its end value).
      await page.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
      await page.waitForTimeout(800);
      const invisible = await page.evaluate(() => [".card", ".chip", ".proc .step", ".port"]
        .map((sel) => {
          const els = [...document.querySelectorAll(sel)];
          const bad = els.filter((e) => { const c = getComputedStyle(e); return parseFloat(c.opacity) < .5 || c.visibility === "hidden" || e.getBoundingClientRect().width < 2; });
          return bad.length ? `${sel} ${bad.length}/${els.length}` : null;
        }).filter(Boolean).join(", "));
      t(`everything visible (${invisible})`, !invisible);

      // The hero ocean: one context, one program, and it must actually build. A
      // shader that fails to compile renders as a flat dark rectangle that reads
      // as a design choice, so nothing else catches it.
      const gl = await page.evaluate(async () => {
        const m = await import("/js/gl/program.js");
        return { errors: m.stats.errors, programs: m.stats.programs, live: m.stats.contexts, asked: window.__glContexts || 0 };
      });
      t("no shader build errors" + (gl.errors.length ? ` (${gl.errors[0]})` : ""), gl.errors.length === 0);
      // Two asks: the tier probe's throwaway and the hero's own.
      t(`one live webgl context (live ${gl.live}, asked ${gl.asked})`, gl.live <= 1 && gl.asked <= 2);
      if (motion === "reduce") {
        t("reduced motion builds no shaders", gl.programs === 0 && gl.live === 0);
        t("reduced motion hides the hero canvas", await page.evaluate(() => { const c = document.querySelector("#sea"); return !c || getComputedStyle(c).display === "none"; }));
      } else {
        t("hero shader built", gl.programs >= 1);
        // Daytime, whatever the clock says, and actually drawing.
        const hero = await page.evaluate(async () => (await import("/js/hero.js")).debug());
        t(`hero sky is daylight and live (alt ${hero.sunAlt}, frames ${hero.frames})`, hero.sunAlt >= 10 && hero.frames > 0);
      }

      // Second visit: no tour. `?tour` replays it, Escape closes it, and a
      // module that never arrives must not leave the page dimmed.
      await page.goto(base + "/", { waitUntil: "load" });
      await page.waitForFunction(() => window.__tour, null, { timeout: 5000 }).catch(() => {});
      t("tour not shown twice", (await page.locator("#tour").count()) === 0 && !(await page.evaluate(() => document.documentElement.classList.contains("touring"))));
      await page.goto(base + "/?tour", { waitUntil: "load" });
      await page.waitForFunction(() => window.__tour, null, { timeout: 5000 }).catch(() => {});
      t("?tour replays the tour", await page.evaluate(() => document.documentElement.classList.contains("touring") && !!document.querySelector("#tour")));
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#tour"), null, { timeout: 3000 }).catch(() => {});
      t("escape closes the tour", (await page.locator("#tour").count()) === 0);
      const errsBefore = errs.length;
      await page.route("**/js/tour.js", (r) => r.abort());
      await page.goto(base + "/?tour", { waitUntil: "load" });
      await page.waitForFunction(() => !document.documentElement.classList.contains("touring"), null, { timeout: 7000 }).catch(() => {});
      t("tour lifts by itself if its script fails", !(await page.evaluate(() => document.documentElement.classList.contains("touring"))));
      await page.unroute("**/js/tour.js");
      errs.splice(errsBefore); // the aborted module is the point of that test, not a defect
      await page.goto(base + "/", { waitUntil: "load" });

      // Owner pages show nothing without the key and everything with it.
      if (vp.name === "desktop" && scheme === "light" && motion === "no-preference") {
        await page.route("**/api/kelly**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leads: [{ ts: Date.now(), type: "handoff", name: "Dana", contact: "dana@example.com", summary: "Asked about the Plantation", transcript: "user: hi" }], stats: { conversations: 4, asks: 9, leads: 1, stories: 1 } }) }));
        await page.route("**/api/brain**", (r) => r.request().method() === "GET"
          ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ fields: [{ key: "about", label: "About Kelly", locked: false }, { key: "rules", label: "Rules", locked: true }], defaults: { about: "x", rules: "r" }, current: { about: "About her", rules: "r" } }) })
          : r.fulfill({ status: 200, contentType: "application/json", body: "{\"ok\":true}" }));
        await page.goto(base + "/kelly.html", { waitUntil: "load" });
        t("owner page hidden without key", await page.evaluate(() => getComputedStyle(document.querySelector("#own")).display === "none" || document.querySelector("#own").hidden));
        await page.goto(base + "/kelly.html?key=test", { waitUntil: "load" });
        await page.waitForTimeout(900);
        t("owner page shows leads", (await page.locator(".own-lead").count()) === 1);
        t("owner stats render", (await page.locator("#stats b").first().innerText()) !== "–");
        t("fee row hidden by default", await page.locator("#feeRow").isHidden());
        await page.goto(base + "/brain.html?key=test", { waitUntil: "load" });
        await page.waitForTimeout(600);
        t("brain renders fields", (await page.locator("#brainForm textarea").count()) === 2);
        t("locked field is readonly", await page.locator("#brainForm textarea[name=rules]").evaluate((e) => e.readOnly));
        await page.goto(base + "/", { waitUntil: "load" });
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      t(`no h-scroll (was ${overflow}px)`, overflow <= 1);

      t(`console clean (${errs.slice(0, 2).join(" | ")})`, errs.length === 0);

      await page.screenshot({ path: resolve(out, `${vp.name}-${motion}-${scheme}.png`), fullPage: vp.name === "desktop" && motion === "reduce" && scheme === "light" });
      await ctx.close();
      console.log(`${failures.some((f) => f.startsWith(label)) ? "✗" : "✓"} ${label}`);
    }
  }
}

await browser.close();
server.close();

if (failures.length) { console.error("\nFAILURES:\n" + failures.map((f) => "  ✗ " + f).join("\n")); process.exit(1); }
console.log("\nAll checks passed.");
