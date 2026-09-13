// POST /api/lead — a captured lead, mirrored into Blobs for the owner page.
// Netlify Forms (posted separately by the client) is what emails Kelly.
import { demoLocked, cleanSession, limited, saveLead, logEvent } from "../../src/lib.mjs";

const clean = (v, n = 200) => String(v ?? "").slice(0, n);
const TYPES = new Set(["handoff", "valuation", "contact"]);

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (demoLocked(req)) return new Response("Preview locked", { status: 403 });
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "anon";
  if (limited(ip, 10)) return new Response("Slow down", { status: 429 });
  let b; try { b = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (!TYPES.has(b.type)) return new Response("Bad type", { status: 400 });
  const lead = {
    type: b.type,
    name: clean(b.name, 80),
    contact: clean(b.contact, 120),
    session: cleanSession(b.session),
    summary: clean(b.summary, 400),
    transcript: clean(b.transcript, 6000),
    payload: typeof b.payload === "object" && b.payload ? JSON.parse(clean(JSON.stringify(b.payload), 4000)) : null,
    page: clean(b.page, 300),
  };
  if (!lead.contact && !lead.name) return new Response("Need a contact", { status: 400 });
  await saveLead(lead);
  await logEvent("lead", { type: lead.type, session: lead.session });
  return Response.json({ ok: true });
};
export const config = { path: "/api/lead" };
