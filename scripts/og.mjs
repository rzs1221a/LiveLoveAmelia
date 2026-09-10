// Renders public/og.png (1200x630) from scripts/og-template.html.
// Run locally with `npm run og` — never at Netlify build time (no Chromium there).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const template = resolve(here, "og-template.html");
const out = resolve(here, "..", "public", "og.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto("file://" + template);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: out, type: "png" });
await browser.close();
console.log("wrote", out);
