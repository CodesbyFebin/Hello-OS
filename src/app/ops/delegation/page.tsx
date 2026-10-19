"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";

type Node = { id: string; name: string; balance: number | null; creditCap: number | null; task: string; status: string | null; delegationId: string | null; children: Node[] };
type Agent = { id: string; name: string; wallet?: { balance: number } | null };

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json" } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`);
  return b as T;
}

function Tree({ n, onRecall }: { n: Node; onRecall: (id: string) => void }) {
  return (
    <li className="ml-4 border-l border-white/10 pl-3 pt-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <b className="text-white">{n.name}</b>
        <span className="text-zinc-400">balance {n.balance ?? "–"} credits</span>
        {n.creditCap !== null && <span className="text-zinc-500">cap {n.creditCap}</span>}
        {n.status && <Badge kind={n.status === "active" ? "real" : "vision"}>{n.status.toUpperCase()}</Badge>}
        {n.task && <span className="text-zinc-500">· {n.task}</span>}
        {n.delegationId && n.status === "active" && <button className={opsBtn} onClick={() => onRecall(n.delegationId!)}>Recall</button>}
      </div>
      {n.children.length > 0 && <ul>{n.children.map((c) => <Tree key={c.id} n={c} onRecall={onRecall} />)}</ul>}
    </li>
  );
}

export default function DelegationPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [trees, setTrees] = React.useState<Node[]>([]);
  const [parentId, setParentId] = React.useState("");
  const [childName, setChildName] = React.useState("");
  const [cap, setCap] = React.useState("10");
  const [task, setTask] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const [a, t] = await Promise.all([j<{ agents: Agent[] }>("/api/agents?limit=100"), j<{ trees: Node[] }>("/api/delegation")]);
      setAgents(a.agents); setTrees(t.trees.filter(Boolean));
    } catch (e) { setMsg(String(e)); }
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  async function spawn() {
    try { await j("/api/delegation", { method: "POST", body: JSON.stringify({ parentId, childName: childName || undefined, creditCap: Number(cap), task }) }); setMsg("Sub-agent spawned and funded."); setChildName(""); setTask(""); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }
  async function recall(id: string) {
    try { const r = await j<{ returned: number }>(`/api/delegation/${id}/recall`, { method: "POST" }); setMsg(`Recalled; ${r.returned} credits returned to parent.`); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <OpsFrame title="Delegation tree" subtitle="A parent funds each sub-agent from its own wallet. The child's balance and daily cap are bounded by that grant. Amounts are prototype credits.">
      <section className={`${opsCard} flex flex-wrap items-center gap-2 text-xs`}>
        <Badge kind="real">LOCAL DB</Badge>
        <select aria-label="Parent agent" value={parentId} onChange={(e) => setParentId(e.target.value)} className="rounded border border-white/10 bg-black/30 px-2 py-1"><option value="">parent agent…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.wallet?.balance ?? 0})</option>)}</select>
        <input aria-label="Child name" value={childName} onChange={(e) => setChildName(e.target.value.slice(0, 60))} placeholder="child name (optional)" className="rounded border border-white/10 bg-black/30 px-2 py-1" />
        <input aria-label="Credit cap" value={cap} onChange={(e) => setCap(e.target.value.slice(0, 8))} className="w-16 rounded border border-white/10 bg-black/30 px-2 py-1" /> credits
        <input aria-label="Task" value={task} onChange={(e) => setTask(e.target.value.slice(0, 300))} placeholder="task" className="w-56 rounded border border-white/10 bg-black/30 px-2 py-1" />
        <button className={opsBtn} disabled={!parentId} onClick={spawn}>Spawn &amp; fund</button>
        {msg && <span className="text-zinc-400">{msg}</span>}
      </section>
      <section className={opsCard}>
        {trees.length === 0 ? <p className="text-xs text-zinc-500">No delegations yet.</p> : <ul className="-ml-4">{trees.map((t) => <Tree key={t.id} n={t} onRecall={recall} />)}</ul>}
      </section>
    </OpsFrame>
  );
}
