// Real checks backing "Live Connection Status" on /integrations.
// Only reports whether things are configured/reachable; never returns secret values.

export type CheckState = "connected" | "configured" | "not-configured" | "unreachable";
export interface StatusCheck { id: string; label: string; state: CheckState; detail: string; connectorIds: number[] }

async function timed<T>(fn: () => Promise<T>, ms = 2500): Promise<T> {
  return Promise.race([fn(), new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))]);
}

export interface StatusDeps {
  env: Record<string, string | undefined>;
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  countTables: () => Promise<number>;
}

export async function runStatusChecks({ env, fetchImpl, countTables }: StatusDeps): Promise<{ checkedAt: string; checks: StatusCheck[] }> {
  const checks: StatusCheck[] = [];
  const mcpUrl = env.HELLO_MCP_URL || "http://localhost:3030";
  try {
    const r = await timed(() => fetchImpl(`${mcpUrl}/tools`, { cache: "no-store" }));
    const data = await r.json();
    const list: { name: string }[] = Array.isArray(data) ? data : data.tools ?? [];
    const n = list.filter((t) => t.name?.startsWith("connector.")).length;
    checks.push({ id: "mcp", label: "hello-mcp service /tools", state: r.ok && n > 0 ? "connected" : "unreachable", detail: r.ok ? `${n} connector tool(s) listed` : `HTTP ${r.status}`, connectorIds: [1, 18] });
  } catch (e) {
    checks.push({ id: "mcp", label: "hello-mcp service /tools", state: "unreachable", detail: (e as Error).message.slice(0, 120), connectorIds: [1, 18] });
  }
  try {
    const n = await timed(countTables);
    checks.push({ id: "db", label: "Prisma datasource (SQLite)", state: "connected", detail: `${n} table(s) reflected`, connectorIds: [18] });
  } catch (e) {
    checks.push({ id: "db", label: "Prisma datasource (SQLite)", state: env.DATABASE_URL ? "unreachable" : "not-configured", detail: env.DATABASE_URL ? (e as Error).message.split("\n").filter(Boolean).pop()?.slice(0, 120) ?? "error" : "DATABASE_URL not set", connectorIds: [18] });
  }
  checks.push({ id: "github-token", label: "GITHUB_TOKEN", state: env.GITHUB_TOKEN ? "configured" : "not-configured", detail: env.GITHUB_TOKEN ? "set (value never exposed)" : "not set; GitHub reads are unauthenticated (60 req/h)", connectorIds: [1] });
  checks.push({ id: "webhook-secret", label: "HELLO_WEBHOOK_SECRET", state: env.HELLO_WEBHOOK_SECRET ? "configured" : "not-configured", detail: env.HELLO_WEBHOOK_SECRET ? "set; webhook intake enabled" : "not set; webhook intake returns 503", connectorIds: [98] });
  return { checkedAt: new Date().toISOString(), checks };
}
