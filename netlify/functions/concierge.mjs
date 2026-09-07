// POST /api/concierge  { messages: [{role, content}, ...] }
// Streams plain text back (text/plain; chunked). Client appends deltas.
import Anthropic from "@anthropic-ai/sdk";
import { BRIEF, RELOCATE } from "../../src/brief.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const MAX_TURNS = 16;
const MAX_CHARS = 1500;

// Cheap per-IP limiter (per function instance; good enough for a personal site — swap for Upstash if abused)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!process.env.ANTHROPIC_API_KEY) return new Response("Concierge not configured", { status: 503 });

  const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "anon";
  if (limited(ip)) return new Response("Slow down a moment.", { status: 429 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return new Response("Need a user message", { status: 400 });

  const mode = body?.mode === "relocate" ? "relocate" : "chat";
  const system = mode === "relocate" ? BRIEF + "\n\n" + RELOCATE : BRIEF;
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: mode === "relocate" ? 1100 : 700,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") ctrl.enqueue(encoder.encode(ev.delta.text));
        }
      } catch (e) {
        ctrl.enqueue(encoder.encode("\n\n(Connection hiccup — try again, or text Kelly at 512-578-9942.)"));
      } finally { ctrl.close(); }
    },
    cancel() { stream.controller?.abort(); },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
};

export const config = { path: "/api/concierge" };
