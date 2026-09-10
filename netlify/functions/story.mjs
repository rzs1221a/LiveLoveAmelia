// POST /api/story  { area, address, type, beds, baths, sqft, condition, timeline, upgrades, session }
// Streams a "Listing Story" — how Kelly would position and launch this specific home.
// Contact details are never sent to the model; they travel with the Netlify form submission.
import Anthropic from "@anthropic-ai/sdk";
import { BRIEF, STORY } from "../../src/brief.mjs";
import { limited, cleanSession, saveTranscript, streamAnthropic } from "../../src/lib.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const str = (v, n = 60) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const clampNum = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? String(n) : "";
};

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!process.env.ANTHROPIC_API_KEY) return new Response("Concierge not configured", { status: 503 });

  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "anon";
  if (limited(ip, 10)) return new Response("Slow down a moment.", { status: 429 });

  let b;
  try { b = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const h = {
    area: str(b.area, 60),
    address: str(b.address, 120),
    type: str(b.type, 40),
    beds: clampNum(b.beds, 0, 20),
    baths: clampNum(b.baths, 0, 20),
    sqft: clampNum(b.sqft, 0, 20000),
    condition: str(b.condition, 40),
    timeline: str(b.timeline, 40),
    upgrades: str(b.upgrades, 300),
  };
  if (!h.area) return new Response("Need an area", { status: 400 });

  const facts = [
    `Area: ${h.area}`,
    h.address && `Street or neighborhood context: ${h.address}`,
    h.type && `Home type: ${h.type}`,
    (h.beds || h.baths || h.sqft) && `Size: ${h.beds || "?"} bed, ${h.baths || "?"} bath, ${h.sqft || "?"} sq ft`,
    h.condition && `Condition: ${h.condition}`,
    h.timeline && `Timeline to sell: ${h.timeline}`,
    h.upgrades && `Owner mentions: ${h.upgrades}`,
  ].filter(Boolean).join("\n");

  const session = cleanSession(b?.session);
  const messages = [{ role: "user", content: `Write the listing story for this home.\n\n${facts}` }];
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 900,
    system: BRIEF + "\n\n" + STORY,
    messages,
  });

  return streamAnthropic(stream, {
    onDone: (reply) => saveTranscript({ session, mode: "story", ip, messages, reply }),
  });
};

export const config = { path: "/api/story" };
