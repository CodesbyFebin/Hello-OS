// Technique 9: webhook-to-intent transpiler. Verifies an HMAC-SHA256 signature
// (GitHub-style "sha256=<hex>" header) with a timing-safe compare, then maps the
// event to a typed intent record. It never executes the intent.
import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(secret: string, body: string) {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export function verifySignature(secret: string | undefined, body: string, header: string | null | undefined): boolean {
  if (!secret || !header || !header.startsWith("sha256=")) return false;
  const expected = Buffer.from(signPayload(secret, body));
  const given = Buffer.from(header.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface Intent {
  kind: string;
  source: string;
  event: string;
  action: string | null;
  summary: string;
  subject: Record<string, unknown>;
  risk: "observe";
  executed: false;
}

export function transpileWebhook(event: string, payload: any, source = "github"): Intent {
  const repo = payload?.repository?.full_name ?? null;
  const base = { source, event, action: payload?.action ?? null, risk: "observe" as const, executed: false as const };
  switch (event) {
    case "push":
      return { ...base, kind: "code.pushed", summary: `${payload?.commits?.length ?? 0} commit(s) pushed to ${payload?.ref ?? "?"} in ${repo}`, subject: { repo, ref: payload?.ref, head: payload?.after } };
    case "pull_request":
      return { ...base, kind: `pull_request.${payload?.action ?? "event"}`, summary: `PR #${payload?.pull_request?.number} ${payload?.action}: ${payload?.pull_request?.title ?? ""}`, subject: { repo, number: payload?.pull_request?.number, url: payload?.pull_request?.html_url } };
    case "issues":
      return { ...base, kind: `issue.${payload?.action ?? "event"}`, summary: `Issue #${payload?.issue?.number} ${payload?.action}: ${payload?.issue?.title ?? ""}`, subject: { repo, number: payload?.issue?.number, url: payload?.issue?.html_url } };
    case "workflow_run":
      return { ...base, kind: `ci.${payload?.workflow_run?.conclusion ?? payload?.workflow_run?.status ?? "event"}`, summary: `Workflow "${payload?.workflow_run?.name}" ${payload?.workflow_run?.status}/${payload?.workflow_run?.conclusion ?? "pending"} on ${payload?.workflow_run?.head_branch}`, subject: { repo, runId: payload?.workflow_run?.id, url: payload?.workflow_run?.html_url } };
    case "ping":
      return { ...base, kind: "webhook.ping", summary: "Webhook ping", subject: { repo, hookId: payload?.hook_id } };
    default:
      return { ...base, kind: "webhook.unknown", summary: `Unmapped event "${event}"`, subject: { repo } };
  }
}

export const MAX_WEBHOOK_BYTES = 256 * 1024;

/** Full pipeline used by the HTTP route; returns [status, body]. */
export function handleWebhook(secret: string | undefined, rawBody: string, signature: string | null, event: string | null): [number, Record<string, unknown>] {
  if (!secret) return [503, { error: "HELLO_WEBHOOK_SECRET is not configured; webhook intake is disabled" }];
  if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) return [413, { error: "payload too large" }];
  if (!verifySignature(secret, rawBody, signature)) return [401, { error: "invalid or missing X-Hub-Signature-256" }];
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return [400, { error: "body must be JSON" }]; }
  return [200, { intent: transpileWebhook(event || "unknown", payload) }];
}
