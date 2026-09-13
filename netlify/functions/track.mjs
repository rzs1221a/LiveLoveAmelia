// POST /api/track — first-party event log. No third-party analytics, no key.
// Ungated on purpose: a view costs nothing to record and views are the point.
import { logEvent, limited, cleanSession } from "../../src/lib.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "anon";
  if (limited(ip, 60)) return new Response(null, { status: 204 });
  let b; try { b = await req.json(); } catch { return new Response(null, { status: 204 }); }
  const ev = String(b.ev || "");
  if (!["view", "ask", "story", "match", "relocate"].includes(ev)) return new Response(null, { status: 204 });
  await logEvent(ev, { session: cleanSession(b.session), q: String(b.q || "").slice(0, 160) || undefined, path: String(b.path || "").slice(0, 120) || undefined });
  return new Response(null, { status: 204 });
};
export const config = { path: "/api/track" };
