// GET/PUT/DELETE /api/brain — the concierge's editable prompt. Owner-gated,
// except GET ?public=1 which returns only the venues field for the island book.
import { ownerLocked, loadBrainFields, saveBrainFields, resetBrain } from "../../src/lib.mjs";
import { FIELDS, DEFAULTS } from "../../src/brief.mjs";

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("public") === "1") {
    const f = await loadBrainFields();
    return Response.json({ venues: f.venues || "" }, { headers: { "Cache-Control": "public, max-age=60" } });
  }
  if (ownerLocked(req)) return new Response("Not found", { status: 404 });
  if (req.method === "GET") {
    return Response.json({ fields: FIELDS, defaults: DEFAULTS, current: await loadBrainFields() }, { headers: { "Cache-Control": "no-store" } });
  }
  if (req.method === "PUT") {
    let b; try { b = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
    try { return Response.json({ ok: true, current: await saveBrainFields(b || {}) }); }
    catch (e) { return new Response("Store unavailable: " + (e?.message || e), { status: 503 }); }
  }
  if (req.method === "DELETE") { await resetBrain(); return Response.json({ ok: true }); }
  return new Response("Method not allowed", { status: 405 });
};
export const config = { path: "/api/brain" };
