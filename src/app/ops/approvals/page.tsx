"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";

type Control = { killSwitch: boolean; approvalThreshold: number; updatedAt: string };
type Approval = { id: string; agentId: string; action: string; riskTier: string; amount: number; status: string; note: string; createdAt: string };
type Entry = { id: string; actor: string; action: string; target: string; detail: string; createdAt: string };

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
  return body as T;
}

const TIERS = [
  ["low", "data.read", "runs immediately"],
  ["medium", "wallet.spend / skill.install at or under threshold", "runs immediately, still capped by the wallet daily cap and circuit breaker"],
  ["high", "wallet.spend / skill.install over threshold", "queued for operator approval"],
  ["critical", "external.send, data.delete", "always queued for operator approval"],
];

export default function ApprovalsPage() {
  const [control, setControl] = React.useState<Control | null>(null);
  const [devMode, setDevMode] = React.useState(false);
  const [approvals, setApprovals] = React.useState<Approval[]>([]);
  const [audit, setAudit] = React.useState<Entry[]>([]);
  const [token, setToken] = React.useState("");
  const [threshold, setThreshold] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const headers = React.useMemo(() => (token ? { "x-operator-token": token } : undefined), [token]);
  const load = React.useCallback(async () => {
    try {
      const [c, a, l] = await Promise.all([j<{ control: Control; devMode: boolean }>("/api/operator"), j<{ approvals: Approval[] }>("/api/approvals"), j<{ entries: Entry[] }>("/api/audit")]);
      setControl(c.control); setDevMode(c.devMode); setApprovals(a.approvals); setAudit(l.entries);
    } catch (e) { setMsg(e instanceof Error ? e.message : "load failed"); }
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  async function update(body: Record<string, unknown>) {
    try { await j("/api/operator", { method: "POST", body: JSON.stringify(body), headers }); setMsg("Saved."); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "failed"); }
  }
  async function decide(id: string, decision: "approve" | "reject") {
    try { const r = await j<{ approval: Approval }>(`/api/approvals/${id}`, { method: "POST", body: JSON.stringify({ decision }), headers }); setMsg(`Approval ${r.approval.status}${r.approval.note ? `: ${r.approval.note}` : ""}`); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "failed"); }
  }

  return (
    <OpsFrame title="Approvals & kill switch" subtitle="Agent spends and skill installs pass through this gate before touching a wallet. Amounts are prototype credits.">
      {devMode && <div className={`${opsCard} border-amber-400/30 text-xs text-amber-200`}>Dev mode: HELLO_OPERATOR_TOKEN is not set, so anyone who can reach this server can act as operator. Set it before exposing the app.</div>}
      <section className={opsCard}>
        <div className="flex flex-wrap items-center gap-3">
          <Badge kind="real">LOCAL DB</Badge>
          <b className="text-white">Kill switch</b>
          <span className={control?.killSwitch ? "text-red-300" : "text-emerald-300"}>{control ? (control.killSwitch ? "ON: all gated actions blocked" : "off") : "…"}</span>
          <button className={opsBtn} disabled={!control} onClick={() => update({ killSwitch: !control?.killSwitch })}>{control?.killSwitch ? "Release kill switch" : "Engage kill switch"}</button>
          <span className="ml-auto text-xs text-zinc-500">Approval threshold: {control?.approvalThreshold ?? "…"} credits</span>
          <input aria-label="New approval threshold" value={threshold} onChange={(e) => setThreshold(e.target.value.slice(0, 10))} placeholder="threshold" className="w-24 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs" />
          <button className={opsBtn} onClick={() => update({ approvalThreshold: Number(threshold) })} disabled={!threshold}>Set</button>
          {!devMode && <input aria-label="Operator token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="operator token" className="w-40 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs" />}
        </div>
        {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
      </section>
      <section className={opsCard}>
        <b className="text-white">Risk categories</b>
        <table className="mt-2 w-full text-left text-xs"><tbody>{TIERS.map(([t, a, r]) => <tr key={t} className="border-t border-white/5"><td className="py-1.5 font-mono text-zinc-200">{t}</td><td className="text-zinc-400">{a}</td><td className="text-zinc-500">{r}</td></tr>)}</tbody></table>
      </section>
      <section className={opsCard}>
        <div className="flex items-center gap-2"><b className="text-white">Approval queue</b><button className={opsBtn} onClick={load}>Refresh</button></div>
        {approvals.length === 0 ? <p className="mt-2 text-xs text-zinc-500">No queued actions. Try a spend above the threshold via POST /api/agents/&lt;id&gt;/wallet/spend.</p> :
          <table className="mt-2 w-full text-left text-xs"><thead className="text-zinc-500"><tr><th>when</th><th>agent</th><th>action</th><th>tier</th><th>credits</th><th>status</th><th /></tr></thead><tbody>
            {approvals.map((a) => <tr key={a.id} className="border-t border-white/5"><td className="py-1.5">{new Date(a.createdAt).toLocaleString()}</td><td className="font-mono">{a.agentId.slice(0, 10)}</td><td className="font-mono">{a.action}</td><td>{a.riskTier}</td><td>{a.amount}</td><td>{a.status}{a.note ? ` · ${a.note}` : ""}</td>
              <td className="space-x-1 text-right">{a.status === "pending" && <><button className={opsBtn} onClick={() => decide(a.id, "approve")}>Approve</button><button className={opsBtn} onClick={() => decide(a.id, "reject")}>Reject</button></>}</td></tr>)}
          </tbody></table>}
      </section>
      <section className={opsCard}>
        <b className="text-white">Audit log</b> <span className="text-xs text-zinc-500">(latest 100)</span>
        <ul className="mt-2 space-y-1 font-mono text-[11px]">{audit.map((e) => <li key={e.id} className="text-zinc-400"><span className="text-zinc-600">{new Date(e.createdAt).toLocaleTimeString()}</span> {e.actor} · <span className="text-zinc-200">{e.action}</span> {e.target} {e.detail}</li>)}</ul>
      </section>
    </OpsFrame>
  );
}
