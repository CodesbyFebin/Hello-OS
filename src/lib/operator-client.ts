// Browser-side operator token handling. The token is typed by the operator into
// a form and kept in sessionStorage for this tab only. It is never in the JS
// bundle, never in persistent browser storage, never in an env var exposed to the client.
export const TOKEN_KEY = "hello.operatorToken";
export const TOKEN_EVENT = "hello:operator-token";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Store | null => {
  try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; }
};

export function getOperatorToken(s: Store | null = store()): string {
  return s?.getItem(TOKEN_KEY) ?? "";
}
export function setOperatorToken(token: string, s: Store | null = store()) {
  const t = token.trim();
  if (t) s?.setItem(TOKEN_KEY, t); else s?.removeItem(TOKEN_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOKEN_EVENT));
}
export function operatorHeaders(s: Store | null = store()): Record<string, string> {
  const t = getOperatorToken(s);
  return t ? { "x-operator-token": t } : {};
}

/** Human-readable message for an auth failure, or null if the status is not an auth failure. */
export function describeAuthError(status: number, body: { code?: string; error?: string } = {}): string | null {
  if (status === 503 && body.code === "OPERATOR_TOKEN_NOT_CONFIGURED") return "Operator actions are disabled on this deployment: HELLO_OPERATOR_TOKEN is not set on the server.";
  if (status === 401 && (body.code === "OPERATOR_TOKEN_REQUIRED" || body.code === "AGENT_AUTH_REQUIRED")) return "Operator token missing or wrong. Enter it in the Operator token panel (kept for this tab only).";
  if (status === 401 || status === 403) return body.error || "Not authorized.";
  if (status === 429) return "Rate limited. Wait a minute and try again.";
  return null;
}
