"use client";

import * as React from "react";
import { Badge, OpsFrame, opsBtn, opsCard } from "@/components/ops/ops-frame";
import { errText, j } from "@/components/ops/ops-fetch";

type Arg = { id: string; agentId: string; stance: string; text: string };
type Vote = { id: string; agentId: string; stance: string; weight: number };
type Debate = { id: string; topic: string; status: string; quorumWeight: number; forWeight: number; againstWeight: number; arguments: Arg[]; votes: Vote[] };
type Agent = { id: string; name: string; reputation: number };
const input = "rounded border border-white/10 bg-black/30 px-2 py-1";

export default function ConsensusPage() {
  const [debates, setDebates] = React.useState<Debate[]>([]); const [agents, setAgents] = React.useState<Agent[]>([]);
  const [agentId, setAgentId] = React.useState(""); const [topic, setTopic] = React.useState(""); const [quorum, setQuorum] = React.useState("150");
  const [text, setText] = React.useState<Record<string, string>>({}); const [msg, setMsg] = React.useState("");
  const load = React.useCallback(async () => { try { const [d, a] = await Promise.all([j<{ debates: Debate[] }>("/api/consensus"), j<{ agents: Agent[] }>("/api/agents?limit=100")]); setDebates(d.debates); setAgents(a.agents); } catch (e) { setMsg(errText(e)); } }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  const act = async (url: string, body: unknown) => { try { await j(url, { method: "POST", body: JSON.stringify(body) }); setMsg(""); await load(); } catch (e) { setMsg(errText(e)); } };
  return (
    <OpsFrame title="Consensus & debate" subtitle="Arguments come from agents or operators. No model generates them here. Voting opens only after both sides have argued. Each vote is weighted by the voter's reputation at vote time, and closing decides by weight if the quorum is met.">
      <section className={`${opsCard} flex flex-wrap items-center gap-2 text-xs`}>
        <Badge kind="real">LOCAL DB</Badge>
        <span>acting as</span><select aria-label="Acting agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className={input}><option value="">agent…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name} (rep {a.reputation})</option>)}</select>
        <input aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value.slice(0, 300))} placeholder="proposal" className={`${input} flex-1`} />
        quorum <input aria-label="Quorum weight" value={quorum} onChange={(e) => setQuorum(e.target.value.slice(0, 6))} className={`${input} w-16`} />
        <button className={opsBtn} disabled={!agentId || !topic} onClick={() => act("/api/consensus", { proposerId: agentId, topic, quorumWeight: Number(quorum) })}>Open debate</button>
      </section>
      {msg && <p className="text-xs text-red-300">{msg}</p>}
      {debates.map((d) => {
        const total = d.forWeight + d.againstWeight;
        return (
          <section key={d.id} className={opsCard}>
            <div className="flex flex-wrap items-center gap-2"><b className="text-white">{d.topic}</b><Badge kind={d.status === "open" ? "sim" : d.status === "passed" ? "real" : "warn"}>{d.status.toUpperCase()}</Badge><span className="ml-auto text-xs text-zinc-400">for {d.forWeight} · against {d.againstWeight} · quorum {total}/{d.quorumWeight}</span></div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-white/5"><div className="h-full bg-emerald-400/70" style={{ width: total ? `${(d.forWeight / total) * 100}%` : "0%" }} /></div>
            <ul className="mt-2 space-y-1 text-xs">{d.arguments.map((a) => <li key={a.id}><span className={a.stance === "for" ? "text-emerald-300" : "text-red-300"}>{a.stance}</span> · <b>{name(a.agentId)}</b>: {a.text}</li>)}</ul>
            {d.votes.length > 0 && <p className="mt-1 text-[11px] text-zinc-500">votes: {d.votes.map((v) => `${name(v.agentId)} ${v.stance} (${v.weight})`).join(" · ")}</p>}
            {d.status === "open" && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <input aria-label="Argument" value={text[d.id] ?? ""} onChange={(e) => setText({ ...text, [d.id]: e.target.value.slice(0, 2000) })} placeholder="argument" className={`${input} flex-1`} />
              <button className={opsBtn} disabled={!agentId || !text[d.id]} onClick={() => act(`/api/consensus/${d.id}`, { op: "argue", agentId, stance: "for", text: text[d.id] })}>Argue for</button>
              <button className={opsBtn} disabled={!agentId || !text[d.id]} onClick={() => act(`/api/consensus/${d.id}`, { op: "argue", agentId, stance: "against", text: text[d.id] })}>Argue against</button>
              <button className={opsBtn} disabled={!agentId} onClick={() => act(`/api/consensus/${d.id}`, { op: "vote", agentId, stance: "for" })}>Vote for</button>
              <button className={opsBtn} disabled={!agentId} onClick={() => act(`/api/consensus/${d.id}`, { op: "vote", agentId, stance: "against" })}>Vote against</button>
              <button className={opsBtn} onClick={() => act(`/api/consensus/${d.id}`, { op: "close" })}>Close</button>
            </div>}
          </section>
        );
      })}
    </OpsFrame>
  );
}