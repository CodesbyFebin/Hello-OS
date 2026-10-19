// Consensus & debate protocol. Agents post arguments for or against a
// proposal; voting opens only after both sides have been argued (adversarial
// cross-examination). Each agent votes once, weighted by its reputation at
// vote time. Closing decides by weight, provided the quorum weight is met.
import { db } from "@/lib/db";

type Stance = "for" | "against";
const isStance = (s: unknown): s is Stance => s === "for" || s === "against";

export async function openDebate(proposerId: string, topic: string, quorumWeight = 100) {
  if (!topic.trim()) throw new Error("topic required");
  if (!(quorumWeight > 0)) throw new Error("quorumWeight must be > 0");
  return db.debate.create({ data: { proposerId, topic: topic.slice(0, 300), quorumWeight } });
}

export async function argue(debateId: string, agentId: string, stance: unknown, text: string) {
  if (!isStance(stance)) throw new Error("stance must be for or against");
  const d = await db.debate.findUnique({ where: { id: debateId } });
  if (!d || d.status !== "open") throw new Error("debate not open");
  if (!(await db.agent.findUnique({ where: { id: agentId }, select: { id: true } }))) throw new Error("agent not found");
  if (!text.trim()) throw new Error("argument text required");
  return db.debateArgument.create({ data: { debateId, agentId, stance, text: text.slice(0, 2000) } });
}

export async function vote(debateId: string, agentId: string, stance: unknown) {
  if (!isStance(stance)) throw new Error("stance must be for or against");
  const d = await db.debate.findUnique({ where: { id: debateId }, include: { arguments: { select: { stance: true } } } });
  if (!d || d.status !== "open") throw new Error("debate not open");
  const sides = new Set(d.arguments.map((a) => a.stance));
  if (!(sides.has("for") && sides.has("against"))) throw new Error("voting opens after both sides have argued");
  const agent = await db.agent.findUnique({ where: { id: agentId }, select: { reputation: true, status: true } });
  if (!agent) throw new Error("agent not found");
  const weight = Math.max(0, agent.reputation ?? 0);
  return db.$transaction(async (tx) => {
    const v = await tx.debateVote.create({ data: { debateId, agentId, stance, weight } });
    await tx.debate.update({ where: { id: debateId }, data: stance === "for" ? { forWeight: { increment: weight } } : { againstWeight: { increment: weight } } });
    return v;
  });
}

export async function closeDebate(debateId: string) {
  const d = await db.debate.findUnique({ where: { id: debateId } });
  if (!d || d.status !== "open") throw new Error("debate not open");
  const total = d.forWeight + d.againstWeight;
  const status = total < d.quorumWeight ? "no_quorum" : d.forWeight > d.againstWeight ? "passed" : "rejected";
  return db.debate.update({ where: { id: debateId }, data: { status, closedAt: new Date() } });
}