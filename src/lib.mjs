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
