// POST /api/concierge  { messages: [{role, content}, ...], mode?, session? }
// Streams plain text back (text/plain; chunked). Client appends deltas.
import Anthropic from "@anthropic-ai/sdk";
import { BRIEF, RELOCATE } from "../../src/brief.mjs";
import { limited, cleanSession, saveTranscript, streamAnthropic } from "../../src/lib.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const MAX_TURNS = 16;
const MAX_CHARS = 1500;

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
  const session = cleanSession(body?.session);
  const system = mode === "relocate" ? BRIEF + "\n\n" + RELOCATE : BRIEF;
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: mode === "relocate" ? 1100 : 700,
    system,
    messages,
  });

  return streamAnthropic(stream, {
    onDone: (reply) => saveTranscript({ session, mode, ip, messages, reply }),
  });
};

export const config = { path: "/api/concierge" };
