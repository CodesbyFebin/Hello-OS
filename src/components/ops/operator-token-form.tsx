"use client";

import * as React from "react";
import { getOperatorToken, setOperatorToken, TOKEN_EVENT } from "@/lib/operator-client";

type Auth = { authorized: true; devMode: boolean } | { authorized: false; status: number; code: string; message: string };

/** Operator token entry. Stored in sessionStorage for this tab only; shows the server's real auth state. */
export function OperatorTokenForm({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [auth, setAuth] = React.useState<Auth | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const check = React.useCallback(async () => {
    const t = getOperatorToken();
    setSaved(Boolean(t));
    try {
      const r = await fetch("/api/operator", { headers: t ? { "x-operator-token": t } : {} });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.message || j.error || `HTTP ${r.status}`); setAuth(null); return; }
      setError(null);
      setAuth(j.auth ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "request failed"); }
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => { void check(); }, 0);
    window.addEventListener(TOKEN_EVENT, check);
    return () => { window.clearTimeout(t); window.removeEventListener(TOKEN_EVENT, check); };
  }, [check]);

  let state: { tone: string; text: string };
  if (error) state = { tone: "text-red-300", text: `Can't reach /api/operator: ${error}` };
  else if (!auth) state = { tone: "text-zinc-400", text: "Checking…" };
  else if (auth.authorized && auth.devMode) state = { tone: "text-amber-300", text: "Dev mode: no token is set on the server, so anyone who can reach it can act as operator." };
  else if (auth.authorized) state = { tone: "text-emerald-300", text: "Operator token accepted." };
  else if (auth.status === 503) state = { tone: "text-red-300", text: "503: operator actions are disabled here because HELLO_OPERATOR_TOKEN is not set on the server." };
  else state = { tone: "text-red-300", text: saved ? "401: the saved token was rejected." : "401: enter the operator token to make changes." };

  return (
    <form
      className={compact ? "flex flex-col gap-1 text-xs" : "flex flex-col gap-2 rounded border border-white/10 p-3 text-xs"}
      onSubmit={(e) => { e.preventDefault(); setOperatorToken(value); setValue(""); }}
      aria-label="Operator token"
    >
      <div className="flex gap-2">
        <input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder={saved ? "token saved for this tab" : "operator token"} aria-label="Operator token" className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1" />
        <button type="submit" className="rounded border border-white/15 px-2 py-1 hover:bg-white/5">Save</button>
        {saved && <button type="button" onClick={() => setOperatorToken("")} className="rounded border border-white/15 px-2 py-1 hover:bg-white/5">Clear</button>}
      </div>
      <p role="status" className={state.tone}>{state.text}</p>
      {!compact && <p className="text-zinc-500">Kept in sessionStorage for this tab only. It is not in the app bundle and is sent as the x-operator-token header.</p>}
    </form>
  );
}
