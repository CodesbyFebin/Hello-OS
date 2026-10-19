"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";
import { errText, j } from "@/components/ops/ops-fetch";

type Agent = { id: string; name: string; wallet?: { balance: number; spentToday: number; circuitOpen: boolean } | null };
type Move = { id: string; type: string; amount: number; reason: string; createdAt: string };
const input = "rounded border border-white/10 bg-black/30 px-2 py-1";

export default function TreasuryPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]); const [moves, setMoves] = React.useState<Move[]>([]); const [pending, setPending] = React.useState(0);
  const [from, setFrom] = React.useState(""); const [to, setTo] = React.useState(""); const [amount, setAmount] = React.useState("10"); const [reason, setReason] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const load = React.useCallback(async () => { try { const [a, t] = await Promise.all([j<{ agents: Agent[] }>("/api/agents?limit=100"), j<{ moves: Move[]; pending: number }>("/api/treasury")]); setAgents(a.agents); setMoves(t.moves); setPending(t.pending); } catch (e) { setMsg(errText(e)); } }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);
  async function move() {
    try { const r = await j<{ pending: boolean; tier: string }>("/api/treasury/reallocate", { method: "POST", body: JSON.stringify({ fromAgentId: from, toAgentId: to, amount: Number(amount), reason }) }); setMsg(r.pending ? `Queued for operator approval (tier ${r.tier}).` : `Moved (tier ${r.tier}).`); await load(); }
    catch (e) { setMsg(errText(e)); }
  }
  return (
    <OpsFrame title="Treasury reallocation" subtitle="Moves prototype credits between agent wallets. Each move passes the approval gate: above the operator threshold it waits for approval, and the kill switch blocks it. The debit goes through the normal wallet path, so the source's daily cap and circuit breaker apply.">
      <section className={`${opsCard} flex flex-wrap items-center gap-2 text-xs`}>
        <Badge kind="real">LOCAL DB</Badge>
        <select aria-label="From agent" value={from} onChange={(e) => setFrom(e.target.value)} className={input}><option value="">from…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.wallet?.balance ?? 0})</option>)}</select>→
        <select aria-label="To agent" value={to} onChange={(e) => setTo(e.target.value)} className={input}><option value="">to…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.wallet?.balance ?? 0})</option>)}</select>
        <input aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value.slice(0, 8))} className={`${input} w-16`} /> credits
        <input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 120))} placeholder="reason" className={input} />
        <button className={opsBtn} disabled={!from || !to} onClick={move}>Reallocate</button>
        <span className="ml-auto text-zinc-400">{pending} pending · <Link className="underline" href="/ops/approvals">approvals</Link></span>
      </section>
      {msg && <p className="text-xs text-zinc-400">{msg}</p>}
      <section className={opsCard}><b className="text-white">Recent moves</b>
        <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-zinc-400">{moves.map((m) => <li key={m.id}>{new Date(m.createdAt).toLocaleTimeString()} {m.type} {m.amount} · {m.reason}</li>)}</ul>
      </section>
    </OpsFrame>
  );
}