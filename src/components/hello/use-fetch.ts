"use client";

import * as React from "react";
import { describeAuthError, operatorHeaders, TOKEN_EVENT } from "@/lib/operator-client";

async function fail(r: Response): Promise<never> {
  const e = await r.json().catch(() => ({}));
  throw new Error(describeAuthError(r.status, e) ?? e.error ?? `HTTP ${r.status}`);
}

export function useFetch<T>(url: string | null, opts?: { refresh?: number }) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState<boolean>(!!url);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    if (!url) return;
    setLoading(true);
    fetch(url, { headers: operatorHeaders() })
      .then(async (r) => {
        if (!r.ok) return fail(r);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  React.useEffect(() => {
    refresh();
    // Re-fetch when the operator token changes (redacted vs full views).
    window.addEventListener(TOKEN_EVENT, refresh);
    if (opts?.refresh) {
      const t = setInterval(refresh, opts.refresh);
      return () => { clearInterval(t); window.removeEventListener(TOKEN_EVENT, refresh); };
    }
    return () => window.removeEventListener(TOKEN_EVENT, refresh);
  }, [refresh, opts?.refresh]);

  return { data, loading, error, refresh, setData };
}

export async function apiPost(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...operatorHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) return fail(r);
  return r.json();
}

export async function apiPatch(url: string, body: any) {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...operatorHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) return fail(r);
  return r.json();
}

export async function apiDelete(url: string) {
  const r = await fetch(url, { method: "DELETE", headers: operatorHeaders() });
  if (!r.ok) return fail(r);
  return r.json();
}
