// Playwright smoke test. Serves public/ statically, mocks the AI endpoints and the
// Netlify Forms POST, then drives every new feature across viewports and themes.
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

      await page.goto(base + "/", { waitUntil: "load" });

      // Preloader never traps the visitor.
      await page.waitForFunction(() => !document.querySelector("#loader"), null, { timeout: 3000 }).catch(() => {});
      t("loader gone", await page.locator("#loader").count() === 0);
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

      // Affordability.
      await page.locator("#afford").scrollIntoViewIfNeeded();
      const before = await page.locator("#afPrice").innerText();
      await page.locator("#afMo").fill("9000");
      await page.waitForTimeout(700);
      t("price recalculates", (await page.locator("#afPrice").innerText()) !== before);
      t("a band highlights", (await page.locator("#afBands li.on").count()) > 0);
      t("legend renders", (await page.locator("#afLegend li").count()) === 3);

      // Compare.
      await page.locator("#compare").scrollIntoViewIfNeeded();
      await page.selectOption("#cmpB", "yulee");
      await page.waitForTimeout(250);
      t("compare bars", (await page.locator(".cmp-row .bar i").count()) === 10);
      t("compare question set", ((await page.getAttribute("#cmpAsk", "data-ask")) || "").includes("Yulee"));

      // Island book.
      await page.locator("#book").scrollIntoViewIfNeeded();
      const all = await page.locator(".bcard").count();
      await page.click('#bookTabs button[data-cat="eats"]');
      await page.waitForTimeout(250);
      const eats = await page.locator(".bcard").count();
      t("book filters", eats > 0 && eats < all);

      // Sound toggle (no audio device in CI; it must not throw).
      if (vp.name === "desktop") {
        await page.click("#soundBtn").catch(() => {});
        await page.waitForTimeout(150);
      }

      // Nothing rendered by JS may end up invisible (a .rv.pre left un-cleared,
      // or a gsap.from() that captured the pre-reveal opacity as its end value).
      await page.evaluate(async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
      await page.waitForTimeout(800);
      const invisible = await page.evaluate(() => [".bcard", ".cmp-card", ".card", ".af-bands li", ".chip"]
        .map((sel) => {
          const els = [...document.querySelectorAll(sel)];
          const bad = els.filter((e) => { const c = getComputedStyle(e); return parseFloat(c.opacity) < .5 || c.visibility === "hidden" || e.getBoundingClientRect().width < 2; });
          return bad.length ? `${sel} ${bad.length}/${els.length}` : null;
        }).filter(Boolean).join(", "));
      t(`everything visible (${invisible})`, !invisible);

      // No horizontal overflow at any width.
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
