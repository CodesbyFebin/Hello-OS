"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";
import { errText, j } from "@/components/ops/ops-fetch";

type Doc = { id: string; title: string; allowedRoles: string };
type Assign = { agentId: string; role: string };
type Agent = { id: string; name: string };
type Result = { roles: string[]; visible: number; hidden: number; results: { id: string; title: string; excerpt: string; score: number; allowedRoles: string[] }[] };
const input = "rounded border border-white/10 bg-black/30 px-2 py-1";

export default function KnowledgePage() {
  const [docs, setDocs] = React.useState<Doc[]>([]); const [assign, setAssign] = React.useState<Assign[]>([]); const [roles, setRoles] = React.useState<string[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [title, setTitle] = React.useState(""); const [body, setBody] = React.useState(""); const [docRoles, setDocRoles] = React.useState<string[]>(["engineer"]);
  const [agentId, setAgentId] = React.useState(""); const [role, setRole] = React.useState("engineer");
  const [q, setQ] = React.useState(""); const [res, setRes] = React.useState<Result | null>(null); const [msg, setMsg] = React.useState("");
  const load = React.useCallback(async () => {
    try { const [k, a] = await Promise.all([j<{ docs: Doc[]; assignments: Assign[]; roles: string[] }>("/api/knowledge"), j<{ agents: Agent[] }>("/api/agents?limit=100")]); setDocs(k.docs); setAssign(k.assignments); setRoles(k.roles); setAgents(a.agents); } catch (e) { setMsg(errText(e)); }
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  async function add() { try { await j("/api/knowledge", { method: "POST", body: JSON.stringify({ title, body, allowedRoles: docRoles }) }); setTitle(""); setBody(""); await load(); } catch (e) { setMsg(errText(e)); } }
  async function grant(revoke = false) { try { await j("/api/knowledge/roles", { method: "POST", body: JSON.stringify({ agentId, role, revoke }) }); await load(); } catch (e) { setMsg(errText(e)); } }
  async function search() { try { setRes(await j<Result>(`/api/knowledge/search?agentId=${encodeURIComponent(agentId)}&q=${encodeURIComponent(q)}`)); } catch (e) { setMsg(errText(e)); } }
  return (
    <OpsFrame title="Knowledge index (RBAC)" subtitle="Each document lists the roles allowed to read it. Search drops documents the agent can't read before ranking, so hidden documents never shape results. Roles are granted and revoked by the operator.">
      <section className={`${opsCard} grid gap-2 text-xs`}>
        <div className="flex items-center gap-2"><Badge kind="real">LOCAL DB</Badge><b className="text-white">Add document</b></div>
        <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 200))} placeholder="title" className={input} />
        <textarea aria-label="Body" value={body} onChange={(e) => setBody(e.target.value.slice(0, 20000))} rows={2} placeholder="body" className={input} />
        <div className="flex flex-wrap items-center gap-2">{roles.map((r) => <label key={r} className="flex items-center gap-1"><input type="checkbox" checked={docRoles.includes(r)} onChange={(e) => setDocRoles(e.target.checked ? [...docRoles, r] : docRoles.filter((x) => x !== r))} />{r}</label>)}<button className={opsBtn} disabled={!title || !body || !docRoles.length} onClick={add}>Add</button></div>
      </section>
      <section className={`${opsCard} flex flex-wrap items-center gap-2 text-xs`}>
        <select aria-label="Agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className={input}><option value="">agent…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className={input}>{roles.map((r) => <option key={r}>{r}</option>)}</select>
        <button className={opsBtn} disabled={!agentId} onClick={() => grant(false)}>Grant</button><button className={opsBtn} disabled={!agentId} onClick={() => grant(true)}>Revoke</button>
        <span className="mx-2 h-4 w-px bg-white/10" />
        <input aria-label="Query" value={q} onChange={(e) => setQ(e.target.value.slice(0, 2000))} placeholder="search as this agent" className={`${input} flex-1`} /><button className={opsBtn} disabled={!agentId || !q} onClick={search}>Search</button>
      </section>
      {msg && <p className="text-xs text-zinc-500">{msg}</p>}
      {res && <section className={`${opsCard} text-xs`}><div className="text-zinc-400">roles: {res.roles.join(", ") || "none"} · visible docs {res.visible} · hidden by RBAC {res.hidden}</div><ul className="mt-2 space-y-1">{res.results.map((r) => <li key={r.id}><span className="font-mono text-zinc-500">{r.score.toFixed(2)}</span> <b className="text-white">{r.title}</b> <span className="text-zinc-500">[{r.allowedRoles.join(", ")}]</span> {r.excerpt}</li>)}</ul></section>}
      <section className={`${opsCard} grid gap-4 text-xs md:grid-cols-2`}>
        <div><b className="text-white">Documents</b><ul className="mt-1 space-y-0.5">{docs.map((d) => <li key={d.id}>{d.title} <span className="text-zinc-500">[{d.allowedRoles}]</span></li>)}</ul></div>
        <div><b className="text-white">Role assignments</b><ul className="mt-1 space-y-0.5">{assign.map((a) => <li key={`${a.agentId}-${a.role}`}>{name(a.agentId)} · {a.role}</li>)}</ul></div>
      </section>
    </OpsFrame>
  );
}
