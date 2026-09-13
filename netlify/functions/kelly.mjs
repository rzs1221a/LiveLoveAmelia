// GET /api/kelly?key=… — everything the owner page shows. Owner-gated.
import { ownerLocked, ownerReport } from "../../src/lib.mjs";

export default async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  if (ownerLocked(req)) return new Response("Not found", { status: 404 });
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const report = await ownerReport(days);
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
};
export const config = { path: "/api/kelly" };
