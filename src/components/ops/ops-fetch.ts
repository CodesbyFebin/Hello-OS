import { describeAuthError, operatorHeaders } from "@/lib/operator-client";

export async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...operatorHeaders(), ...(init?.headers ?? {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(describeAuthError(r.status, b) ?? (b.error || `HTTP ${r.status}`));
  return b as T;
}
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
