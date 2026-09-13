// Shared helpers for the Netlify Functions. Server-only.

/** Cheap per-IP limiter (per function instance; good enough for a personal site). */
const hits = new Map();
export function limited(ip, max = 20) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}

export const cleanSession = (s) => (/^[A-Za-z0-9-]{8,64}$/.test(s || "") ? s : null);

/** Short, salted hash so transcripts can be grouped without storing an IP. */
export async function ipHash(ip) {
  try {
    const data = new TextEncoder().encode(String(ip) + (process.env.IP_SALT || "lla"));
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return "anon"; }
}

/** Store a transcript in Netlify Blobs. Never throws, never blocks for long. */
export async function saveTranscript({ session, mode, ip, messages, reply }) {
  if (!session) return;
  const write = (async () => {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("transcripts");
    const key = mode === "chat" ? `${session}/chat.json` : `${session}/${mode}-${Date.now()}.json`;
    await store.setJSON(key, {
      ts: new Date().toISOString(),
      ipHash: await ipHash(ip),
      mode, session, messages, reply,
    });
  })();
  try {
    await Promise.race([write, new Promise((r) => setTimeout(r, 1500))]);
  } catch (e) {
    console.warn("transcript not stored:", e?.message || e);
  }
}

/**
 * Pipe an Anthropic stream out as plain text.
 * onDone runs before the stream closes, so the invocation stays alive long enough to log.
 */
export function streamAnthropic(stream, { onDone } = {}) {
  const encoder = new TextEncoder();
  let full = "";
  const readable = new ReadableStream({
    async start(ctrl) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            full += ev.delta.text;
            ctrl.enqueue(encoder.encode(ev.delta.text));
          }
        }
      } catch {
        ctrl.enqueue(encoder.encode("\n\n(Connection hiccup — try again, or text Kelly at 512-578-9942.)"));
      } finally {
        try { await onDone?.(full); } catch {}
        ctrl.close();
      }
    },
    cancel() { stream.controller?.abort(); },
  });
  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

/* PRE-LAUNCH gate. The site is public before its subject has signed, so the
 * paid endpoints answer only to a browser that has been unlocked by visiting
 * the page once with ?demo=<key>. This stops strangers spending the API
 * budget; it is not a secret, since the key ships in the client. Delete
 * `demoLocked` and its three call sites the day she signs. */
export const DEMO_KEY = "amelia-preview-2026";
export function demoLocked(req) {
  return req.headers.get("x-demo") !== DEMO_KEY;
}

/* ───────────── Lead pipeline ─────────────
 * Netlify Forms is what emails Kelly. Blobs is what the pitch page reads.
 * Both are written; neither is allowed to fail the request. */

async function blob(storeName) {
  const { getStore } = await import("@netlify/blobs");
  return getStore(storeName);
}
const raced = (p, ms = 1500) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]).catch((e) => console.warn("blob write skipped:", e?.message || e));

const EVENTS = new Set(["view", "ask", "story", "match", "relocate", "lead"]);
export function logEvent(ev, data = {}) {
  if (!EVENTS.has(ev)) return Promise.resolve();
  const ts = Date.now();
  const day = new Date(ts).toISOString().slice(0, 10);
  return raced((async () => {
    const store = await blob("events");
    await store.setJSON(`${day}/${ts}-${Math.random().toString(36).slice(2, 8)}.json`, { ts, ev, ...data });
  })());
}

export function saveLead(lead) {
  const ts = Date.now();
  return raced((async () => {
    const store = await blob("leads");
    await store.setJSON(`${ts}-${lead.session || "anon"}.json`, { ts, ...lead });
  })(), 2500);
}

/* Everything an owner page needs, aggregated over the last N days. */
export async function ownerReport(days = 30) {
  const since = Date.now() - days * 86400_000;
  const out = { leads: [], stats: { views: 0, asks: 0, conversations: 0, leads: 0, stories: 0, matches: 0, relocates: 0, topQuestions: [] } };
  try {
    const leads = await blob("leads");
    const { blobs } = await leads.list();
    const recent = blobs.filter((b) => Number(b.key.split("-")[0]) >= since).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 200);
    out.leads = (await Promise.all(recent.map((b) => leads.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    out.stats.leads = out.leads.length;
  } catch (e) { console.warn("leads unavailable:", e?.message || e); }
  try {
    const events = await blob("events");
    const sessions = new Set(), qs = new Map();
    for (let d = 0; d <= days; d++) {
      const day = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
      const { blobs } = await events.list({ prefix: `${day}/` });
      const items = await Promise.all(blobs.slice(0, 2000).map((b) => events.get(b.key, { type: "json" }).catch(() => null)));
      for (const e of items) {
        if (!e) continue;
        if (e.ev === "view") out.stats.views++;
        if (e.ev === "ask") { out.stats.asks++; if (e.session) sessions.add(e.session); if (e.q) qs.set(e.q, (qs.get(e.q) || 0) + 1); }
        if (e.ev === "story") out.stats.stories++;
        if (e.ev === "match") out.stats.matches++;
        if (e.ev === "relocate") out.stats.relocates++;
      }
    }
    out.stats.conversations = sessions.size;
    out.stats.topQuestions = [...qs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([q, n]) => ({ q, n }));
  } catch (e) { console.warn("events unavailable:", e?.message || e); }
  return out;
}

/* Owner gate for the pitch page and the brain editor. A constant until
 * launch, when it moves to process.env.OWNER_KEY — the README says where.
 * Longer than the demo key on purpose: this one reads leads. */
export const OWNER_KEY = process.env.OWNER_KEY || "kv-owner-7f3a9c2e51b8d4";
export function ownerLocked(req) {
  const url = new URL(req.url);
  return (url.searchParams.get("key") || req.headers.get("x-owner")) !== OWNER_KEY;
}

/* ───────────── The brain ─────────────
 * Owner-editable prompt fields, stored in Blobs, composed on read. Cached
 * per function instance for a minute so an edit lands quickly without a
 * store read on every turn. Falls back to the shipped defaults on any error. */
import { DEFAULTS, compose, FIELDS } from "./brief.mjs";
let brainCache = { at: 0, fields: null };
export async function loadBrainFields() {
  if (Date.now() - brainCache.at < 60_000 && brainCache.fields) return brainCache.fields;
  let fields = { ...DEFAULTS };
  try {
    const store = await blob("brain");
    const saved = await Promise.race([store.get("current.json", { type: "json" }), new Promise((r) => setTimeout(() => r(null), 1200))]);
    if (saved && typeof saved === "object") for (const f of FIELDS) if (!f.locked && typeof saved[f.key] === "string") fields[f.key] = saved[f.key];
  } catch (e) { console.warn("brain override unavailable:", e?.message || e); }
  brainCache = { at: Date.now(), fields };
  return fields;
}
/* The system prompt for one request. An owner may pass a draft to try. */
export async function brainFor(req, body) {
  const draft = body?.brainDraft;
  if (draft && typeof draft === "object" && !ownerLocked(req)) return compose({ ...(await loadBrainFields()), ...draft });
  return compose(await loadBrainFields());
}
export async function saveBrainFields(fields) {
  const store = await blob("brain");
  const clean = {};
  for (const f of FIELDS) if (!f.locked && typeof fields[f.key] === "string") clean[f.key] = fields[f.key].slice(0, 6000);
  const ts = Date.now();
  await store.setJSON(`history/${ts}.json`, clean);
  await store.setJSON("current.json", clean);
  brainCache = { at: 0, fields: null };
  return clean;
}
export async function resetBrain() {
  const store = await blob("brain");
  await store.delete("current.json").catch(() => {});
  brainCache = { at: 0, fields: null };
}
