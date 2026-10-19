// Checkpoint & resume. A snapshot is a portable JSON document of an agent's
// identity (public parts only), latest soul, CORE/RECALL memories, wallet
// figures and caller-supplied task state, sealed with a SHA-256 over its
// canonical JSON. It captures records, not model internals.
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export type SnapshotDoc = {
  format: "hello-snapshot/v1";
  createdAt: string;
  agent: { id: string; did: string; name: string };
  soul: { version: number; hash: string } | null;
  memories: { tier: string; kind: string; content: string; tags: string }[];
  wallet: { balance: number; dailyCap: number } | null;
  task: unknown;
};

const canonical = (v: unknown): string => JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val));
export const sealOf = (doc: SnapshotDoc) => createHash("sha256").update(canonical(doc)).digest("hex");

export async function createSnapshot(agentId: string, task: unknown, label = "") {
  const agent = await db.agent.findUnique({ where: { id: agentId }, select: { id: true, did: true, name: true } });
  if (!agent) return null;
  const [soul, memories, wallet] = await Promise.all([
    db.soulVersion.findFirst({ where: { agentId }, orderBy: { version: "desc" }, select: { version: true, hash: true } }),
    db.memory.findMany({ where: { agentId, tier: { in: ["CORE", "RECALL", "RAM"] }, validTo: null }, orderBy: { createdAt: "asc" }, take: 200, select: { tier: true, kind: true, content: true, tags: true } }),
    db.wallet.findUnique({ where: { agentId }, select: { balance: true, dailyCap: true } }),
  ]);
  const doc: SnapshotDoc = { format: "hello-snapshot/v1", createdAt: new Date().toISOString(), agent, soul, memories, wallet, task: task ?? null };
  const sha256 = sealOf(doc);
  const row = await db.agentSnapshot.create({ data: { agentId, label: label.slice(0, 120), json: JSON.stringify(doc), sha256 } });
  return { id: row.id, sha256, doc };
}

/** Verify the seal, then restore any missing working memories onto the agent
 * (matched by DID) and hand back the task state. Wallet figures are NOT
 * restored: credits never move as a side effect of resume. */
export async function resumeSnapshot(doc: SnapshotDoc, sha256: string) {
  if (doc?.format !== "hello-snapshot/v1") return { ok: false as const, status: 400, error: "unsupported snapshot format" };
  if (sealOf(doc) !== sha256) return { ok: false as const, status: 422, error: "seal mismatch: snapshot was modified" };
  const agent = await db.agent.findUnique({ where: { did: doc.agent.did }, select: { id: true } });
  if (!agent) return { ok: false as const, status: 404, error: "agent with this DID not found on this instance" };
  const existing = new Set((await db.memory.findMany({ where: { agentId: agent.id }, select: { content: true } })).map((m) => m.content));
  const missing = doc.memories.filter((m) => !existing.has(m.content));
  if (missing.length) await db.memory.createMany({ data: missing.map((m) => ({ agentId: agent.id, tier: m.tier, kind: m.kind, content: m.content, tags: m.tags, provenance: `snapshot:${sha256.slice(0, 12)}` })) });
  await db.agentSnapshot.updateMany({ where: { sha256 }, data: { resumedAt: new Date() } });
  return { ok: true as const, agentId: agent.id, restoredMemories: missing.length, task: doc.task };
}
