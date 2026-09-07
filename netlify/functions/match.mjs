// POST /api/match  { saturday, type, budget, timeline }
// Returns JSON { area, tagline, why, runnerUp, runnerUpWhy }
import Anthropic from "@anthropic-ai/sdk";
import { BRIEF, AREAS } from "../../src/brief.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const clean = (v) => String(v ?? "").slice(0, 60);

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "not_configured" }, { status: 503 });
  let b; try { b = await req.json(); } catch { return Response.json({ error: "bad_json" }, { status: 400 }); }
  const p = { saturday: clean(b.saturday), type: clean(b.type), budget: clean(b.budget), timeline: clean(b.timeline) };
  if (Object.values(p).some((v) => !v)) return Response.json({ error: "incomplete" }, { status: 400 });

  const prompt = `A website visitor answered a 4-question quiz. Ideal Saturday: "${p.saturday}". Buying: "${p.type}". Budget: "${p.budget}". Timeline: "${p.timeline}". Choose the single best-fit area from: ${AREAS.join(", ")}. Be realistic about budget (e.g. under $500K rarely buys on the island itself; steer to Yulee or a condo). Reply with ONLY a JSON object, no prose: {"area": string, "tagline": string (max 8 words), "why": string (2-3 sentences, second person, warm, specific, no protected-class language), "runnerUp": string, "runnerUpWhy": string (1 sentence)}`;

  const client = new Anthropic();
  const res = await client.messages.create({ model: MODEL, max_tokens: 400, system: BRIEF, messages: [{ role: "user", content: prompt }] });
  const text = res.content.map((c) => c.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : text);
    return Response.json({ area: clean(j.area), tagline: clean(j.tagline), why: String(j.why ?? "").slice(0, 600), runnerUp: clean(j.runnerUp), runnerUpWhy: String(j.runnerUpWhy ?? "").slice(0, 300) });
  } catch {
    return Response.json({ error: "parse" }, { status: 502 });
  }
};

export const config = { path: "/api/match" };
