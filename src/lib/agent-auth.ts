// Per-agent request authentication (Ed25519 request signatures).
//
// Each agent gets a request-auth keypair separate from its DID key. The server
// stores only the public half; the private half is returned once (on agent
// creation or when the operator issues/rotates a key) and is never stored.
//
// A signed request carries:
//   x-hello-agent-id   agent id
//   x-hello-timestamp  unix ms; must be within ±SIG_WINDOW_MS of server time
//   x-hello-nonce      16-128 chars [A-Za-z0-9_-]; single use per agent
//   x-hello-signature  hex Ed25519 signature over canonicalRequest(...)
// canonicalRequest = "HELLO-AGENT-SIG-V1\n" + METHOD + "\n" + path?query + "\n" + timestamp + "\n" + nonce + "\n" + sha256hex(body)
import * as ed from "@noble/ed25519";
import { createHash } from "node:crypto";

export const SIG_WINDOW_MS = 5 * 60 * 1000;
export const SIG_HEADERS = { agent: "x-hello-agent-id", ts: "x-hello-timestamp", nonce: "x-hello-nonce", sig: "x-hello-signature" } as const;

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const unhex = (s: string) => new Uint8Array(Buffer.from(s, "hex"));
export const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");

export function canonicalRequest(method: string, pathWithQuery: string, timestamp: string, nonce: string, body: string): string {
  return ["HELLO-AGENT-SIG-V1", method.toUpperCase(), pathWithQuery, timestamp, nonce, sha256hex(body)].join("\n");
}

export async function newAuthKeypair(): Promise<{ publicKeyHex: string; secretHex: string }> {
  const seed = ed.utils.randomSecretKey();
  return { publicKeyHex: hex(await ed.getPublicKeyAsync(seed)), secretHex: hex(seed) };
}

/** Client helper (agents, scripts, tests): headers for a signed request. */
export async function signAgentRequest(opts: { agentId: string; secretHex: string; method: string; url: string; body?: string; nonce: string; timestamp?: number }): Promise<Record<string, string>> {
  const u = new URL(opts.url, "http://local");
  const ts = String(opts.timestamp ?? Date.now());
  const msg = canonicalRequest(opts.method, u.pathname + u.search, ts, opts.nonce, opts.body ?? "");
  const sig = hex(await ed.signAsync(new TextEncoder().encode(msg), unhex(opts.secretHex)));
  return { [SIG_HEADERS.agent]: opts.agentId, [SIG_HEADERS.ts]: ts, [SIG_HEADERS.nonce]: opts.nonce, [SIG_HEADERS.sig]: sig };
}

export type ParsedSig = { agentId: string; timestamp: number; nonce: string; signature: string; message: string };

/** Pure part: parse and shape-check the headers, build the canonical message. */
export function parseSignedRequest(req: Request, body: string, now = Date.now()): { present: false } | { present: true; ok: false; status: number; code: string; error: string } | { present: true; ok: true; parsed: ParsedSig } {
  const h = (k: string) => req.headers.get(k);
  const agentId = h(SIG_HEADERS.agent), ts = h(SIG_HEADERS.ts), nonce = h(SIG_HEADERS.nonce), signature = h(SIG_HEADERS.sig);
  if (!agentId && !ts && !nonce && !signature) return { present: false };
  const bad = (code: string, error: string, status = 401) => ({ present: true as const, ok: false as const, status, code, error });
  if (!agentId || !ts || !nonce || !signature) return bad("AGENT_SIG_INCOMPLETE", `send all of ${Object.values(SIG_HEADERS).join(", ")}`);
  if (!/^\d{10,16}$/.test(ts)) return bad("AGENT_SIG_BAD_TIMESTAMP", "x-hello-timestamp must be unix milliseconds");
  if (Math.abs(now - Number(ts)) > SIG_WINDOW_MS) return bad("AGENT_SIG_EXPIRED", `timestamp outside the ±${SIG_WINDOW_MS / 1000}s window; check the client clock`);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return bad("AGENT_SIG_BAD_NONCE", "x-hello-nonce must be 16-128 chars of [A-Za-z0-9_-]");
  if (!/^[0-9a-f]{128}$/i.test(signature)) return bad("AGENT_SIG_MALFORMED", "x-hello-signature must be 64 bytes hex");
  const u = new URL(req.url);
  return { present: true, ok: true, parsed: { agentId: agentId.slice(0, 64), timestamp: Number(ts), nonce, signature, message: canonicalRequest(req.method, u.pathname + u.search, ts, nonce, body) } };
}

export async function verifyWithKey(message: string, signatureHex: string, publicKeyHex: string): Promise<boolean> {
  try { return await ed.verifyAsync(unhex(signatureHex), new TextEncoder().encode(message), unhex(publicKeyHex)); } catch { return false; }
}
