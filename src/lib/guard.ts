// Request guard for write routes: body bounds, who is acting (operator, a
// signed agent, or local dev mode), replay protection (nonce + timestamp
// window), DB-backed rate limits and Idempotency-Key handling.
// DB-backed so limits and nonces hold across Vercel serverless instances.
import { db } from "@/lib/db";
import { operatorAuth } from "@/lib/operator-auth";
import { parseSignedRequest, verifyWithKey, SIG_WINDOW_MS, sha256hex } from "@/lib/agent-auth";

type Env = Record<string, string | undefined>;
export type Principal = { kind: "operator" } | { kind: "agent"; agentId: string } | { kind: "dev" };
type Fail = { ok: false; response: Response };

const fail = (status: number, code: string, error: string, headers: Record<string, string> = {}): Fail =>
  ({ ok: false, response: Response.json({ error, code }, { status, headers }) });

export const DEFAULT_MAX_BODY = 64 * 1024;

/** Reads the body once, bounded. Empty body → json = {}. */
export async function readBody(req: Request, maxBytes = DEFAULT_MAX_BODY): Promise<{ ok: true; text: string; json: any } | Fail> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) return fail(413, "BODY_TOO_LARGE", `request body exceeds ${maxBytes} bytes`);
  const text = req.method === "GET" || req.method === "HEAD" ? "" : await req.text().catch(() => "");
  if (text.length > maxBytes) return fail(413, "BODY_TOO_LARGE", `request body exceeds ${maxBytes} bytes`);
  if (!text.trim()) return { ok: true, text, json: {} };
  try {
    const json = JSON.parse(text);
    if (!json || typeof json !== "object" || Array.isArray(json)) return fail(400, "BAD_JSON", "body must be a JSON object");
    return { ok: true, text, json };
  } catch { return fail(400, "BAD_JSON", "body must be valid JSON"); }
}

/** Single-use nonce per principal. Returns false if already seen. */
export async function consumeNonce(principal: string, nonce: string): Promise<boolean> {
  await db.requestNonce.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * SIG_WINDOW_MS) } } }).catch(() => {});
  try { await db.requestNonce.create({ data: { principal, nonce } }); return true; } catch { return false; }
}

/**
 * Who may act. `agents` = agent ids allowed to act on this request (e.g. the
 * wallet owner). Operator token always passes. A signed agent request passes
 * if its agent is in `agents`. Unsigned requests pass only in dev mode.
 */
export async function authenticate(req: Request, body: string, agents: string[], env: Env = process.env): Promise<{ ok: true; principal: Principal } | Fail> {
  const op = operatorAuth(req, env);
  if (op.ok && !op.devMode) return { ok: true, principal: { kind: "operator" } };
  const sig = parseSignedRequest(req, body);
  if (sig.present) {
    if (!sig.ok) return fail(sig.status, sig.code, sig.error);
    const { agentId, nonce, signature, message } = sig.parsed;
    const agent = await db.agent.findUnique({ where: { id: agentId }, select: { authPublicKeyHex: true, authKeyRevokedAt: true } });
    if (!agent) return fail(401, "AGENT_UNKNOWN", "unknown agent");
    if (agent.authKeyRevokedAt || !agent.authPublicKeyHex) return fail(401, "AGENT_KEY_REVOKED", "this agent has no active request key; the operator can issue one at POST /api/agents/:id/auth-key");
    if (!(await verifyWithKey(message, signature, agent.authPublicKeyHex))) return fail(401, "AGENT_SIG_INVALID", "signature does not verify");
    if (!(await consumeNonce(`agent:${agentId}`, nonce))) return fail(409, "REPLAYED", "nonce already used; sign each request with a fresh nonce");
    if (!agents.includes(agentId)) return fail(403, "AGENT_FORBIDDEN", "this agent may not act on this resource");
    return { ok: true, principal: { kind: "agent", agentId } };
  }
  if (op.ok && op.devMode) return { ok: true, principal: { kind: "dev" } };
  if (!op.ok && op.code === "OPERATOR_TOKEN_NOT_CONFIGURED") return fail(401, "AGENT_AUTH_REQUIRED", "sign this request as the acting agent (x-hello-* headers); operator actions are disabled until HELLO_OPERATOR_TOKEN is set");
  return fail(401, "AGENT_AUTH_REQUIRED", "sign this request as the acting agent (x-hello-* headers) or send the operator token");
}

/** Operator-or-dev only, through the same response shape. */
export function requireOperator(req: Request, env: Env = process.env): { ok: true; principal: Principal } | Fail {
  const op = operatorAuth(req, env);
  if (op.ok) return { ok: true, principal: op.devMode ? { kind: "dev" } : { kind: "operator" } };
  return fail(op.status, op.code, op.error);
}

export function clientKey(req: Request, principal?: Principal): string {
  if (principal?.kind === "agent") return `agent:${principal.agentId}`;
  if (principal?.kind === "operator") return "operator";
  // On Vercel x-forwarded-for is set by the platform; elsewhere it can be spoofed unless a proxy overwrites it.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip.slice(0, 64)}`;
}

/** Fixed-window counter in the database. Limit from env HELLO_RATE_LIMIT_<BUCKET> or the default. */
export async function rateLimit(bucket: string, key: string, defaultLimit: number, windowMs = 60_000, env: Env = process.env): Promise<{ ok: true; remaining: number } | Fail> {
  if (env.HELLO_RATE_LIMIT === "off") return { ok: true, remaining: Infinity };
  const fromEnv = Number(env[`HELLO_RATE_LIMIT_${bucket.toUpperCase()}`]);
  const limit = Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : defaultLimit;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const k = `${bucket}:${key}`;
  let count = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await db.rateLimitBucket.upsert({ where: { key_windowStart: { key: k, windowStart } }, create: { key: k, windowStart, count: 1 }, update: { count: { increment: 1 } } });
      count = row.count; break;
    } catch (e) { if (attempt === 2) throw e; }
  }
  if (count === 1) await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(now - 10 * windowMs) } } }).catch(() => {});
  if (count > limit) {
    const retry = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
    return fail(429, "RATE_LIMITED", `rate limit ${limit} per ${windowMs / 1000}s for ${bucket}; retry later`, { "retry-after": String(retry) });
  }
  return { ok: true, remaining: limit - count };
}

const IDEM_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotency-Key: same key + same request → the stored response is returned
 * (header idempotent-replayed: true) and the action does not run again.
 * Same key + different request → 422. Concurrent duplicate → 409.
 * Responses with status >= 500 are not stored, so the client may retry.
 */
export async function idempotent(req: Request, scope: string, requestText: string, run: () => Promise<Response>): Promise<Response> {
  const key = req.headers.get("idempotency-key");
  if (!key) return run();
  if (!/^[\x21-\x7e]{1,128}$/.test(key)) return Response.json({ error: "Idempotency-Key must be 1-128 visible ASCII characters", code: "BAD_IDEMPOTENCY_KEY" }, { status: 400 });
  const u = new URL(req.url);
  const requestHash = sha256hex(`${req.method}\n${u.pathname}${u.search}\n${requestText}`);
  await db.idempotencyRecord.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - IDEM_TTL_MS) } } }).catch(() => {});
  try {
    await db.idempotencyRecord.create({ data: { scope, key, requestHash, status: 0 } });
  } catch {
    const prev = await db.idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
    if (!prev) return Response.json({ error: "idempotency conflict, retry", code: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
    if (prev.requestHash !== requestHash) return Response.json({ error: "Idempotency-Key was already used for a different request", code: "IDEMPOTENCY_KEY_REUSED" }, { status: 422 });
    if (prev.status === 0) return Response.json({ error: "a request with this Idempotency-Key is still in progress", code: "IDEMPOTENCY_IN_PROGRESS" }, { status: 409 });
    return new Response(prev.responseJson, { status: prev.status, headers: { "content-type": "application/json", "idempotent-replayed": "true" } });
  }
  let res: Response;
  try { res = await run(); } catch (e) { await db.idempotencyRecord.delete({ where: { scope_key: { scope, key } } }).catch(() => {}); throw e; }
  const text = await res.clone().text();
  if (res.status >= 500) await db.idempotencyRecord.delete({ where: { scope_key: { scope, key } } }).catch(() => {});
  else await db.idempotencyRecord.update({ where: { scope_key: { scope, key } }, data: { status: res.status, responseJson: text } });
  return res;
}

export const principalScope = (p: Principal) => (p.kind === "agent" ? `agent:${p.agentId}` : p.kind);
export const principalLabel = (p: Principal) => (p.kind === "agent" ? p.agentId : p.kind === "operator" ? "operator" : "operator (dev mode)");

/**
 * One call for a write route: read+bound body, authenticate, rate-limit.
 * `agents` may be a function of the parsed body (e.g. body.posterId).
 */
export async function guardWrite(req: Request, opts: { bucket: string; limit?: number; maxBytes?: number; agents?: string[] | ((json: any) => string[] | Promise<string[]>); operatorOnly?: boolean }): Promise<{ ok: true; json: any; text: string; principal: Principal } | Fail> {
  const body = await readBody(req, opts.maxBytes);
  if (!body.ok) return body;
  let auth: { ok: true; principal: Principal } | Fail;
  if (opts.operatorOnly) auth = requireOperator(req);
  else {
    const agents = typeof opts.agents === "function" ? await opts.agents(body.json) : opts.agents ?? [];
    auth = await authenticate(req, body.text, agents.filter(Boolean).map(String));
  }
  if (!auth.ok) return auth;
  const rl = await rateLimit(opts.bucket, clientKey(req, auth.principal), opts.limit ?? 120);
  if (!rl.ok) return rl;
  return { ok: true, json: body.json, text: body.text, principal: auth.principal };
}
