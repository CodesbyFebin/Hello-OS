// Live dashboard snapshot used by GET /api/sync (SSE) and its ?once=1 polling fallback.
// Everything comes from the database; nothing here is sample data.
import { createHash } from "node:crypto";
type PrismaClient = typeof import("./db")["db"];

export const SEED_MARKER = "seed.run";

export async function buildSnapshot(db: PrismaClient, now = new Date()) {
  const since = new Date(now.getTime() - 12 * 3600_000);
  const [agentCount, activeAgents, missionCount, memories, wallets, treasury, seedMark, agents, missions, calls, traces, recentTraceTimes, cortex, diagnostics] = await Promise.all([
    db.agent.count(),
    db.agent.count({ where: { status: "Active" } }),
    db.mission.count(),
    db.memory.count(),
    db.wallet.count(),
    db.wallet.aggregate({ _sum: { balance: true } }),
    db.auditLog.findFirst({ where: { action: SEED_MARKER }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.agent.findMany({
      take: 30, orderBy: { reputation: "desc" },
      select: { id: true, name: true, tagline: true, did: true, status: true, guardianTier: true, reputation: true, createdAt: true,
        guild: { select: { name: true, color: true } }, wallet: { select: { balance: true } }, _count: { select: { tracesAuthored: true, missionsPosted: true } } },
    }),
    db.mission.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, reward: true, eta: true, difficulty: true, createdAt: true, poster: { select: { name: true } }, guild: { select: { name: true, color: true } }, _count: { select: { claims: true } } } }),
    db.mcpToolCall.findMany({ take: 15, orderBy: { createdAt: "desc" }, select: { id: true, toolName: true, latencyMs: true, receiptHash: true, isError: true, createdAt: true } }),
    db.trace.findMany({ take: 10, orderBy: { startedAt: "desc" }, select: { id: true, title: true, status: true, startedAt: true, agent: { select: { name: true } } } }),
    db.trace.findMany({ where: { startedAt: { gte: since } }, select: { startedAt: true } }),
    db.cortexMemory.findMany({ take: 6, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, task: true, content: true, agentDid: true, createdAt: true } }),
    db.diagnostic.findMany({ take: 10, orderBy: { createdAt: "desc" }, select: { id: true, filePath: true, line: true, errorCode: true, message: true } }),
  ]);
  // Real traces-per-hour for the last 12 hours (oldest → newest).
  const tracesPerHour = Array.from({ length: 12 }, () => 0);
  for (const t of recentTraceTimes) {
    const idx = 11 - Math.floor((now.getTime() - t.startedAt.getTime()) / 3600_000);
    if (idx >= 0 && idx < 12) tracesPerHour[idx]++;
  }
  const missionsByStatus: Record<string, number> = {};
  for (const m of await db.mission.groupBy({ by: ["status"], _count: { _all: true } })) missionsByStatus[m.status] = m._count._all;
  const agentsByStatus: Record<string, number> = {};
  for (const a of await db.agent.groupBy({ by: ["status"], _count: { _all: true } })) agentsByStatus[a.status] = a._count._all;

  const body = {
    seeded: Boolean(seedMark),
    seededAt: seedMark?.createdAt ?? null,
    counts: { agents: agentCount, activeAgents, missions: missionCount, memories, wallets },
    treasury: treasury._sum.balance ?? 0,
    agentsByStatus, missionsByStatus, tracesPerHour,
    agents, missions, calls, traces, cortex, diagnostics,
  };
  const json = JSON.stringify(body);
  return { version: createHash("sha256").update(json).digest("hex").slice(0, 16), generatedAt: now.toISOString(), ...body };
}

export type SyncSnapshot = Awaited<ReturnType<typeof buildSnapshot>>;

/** SSE stream: sends a snapshot immediately, then again whenever its version changes. */
export function snapshotStream(db: PrismaClient, signal: AbortSignal, intervalMs = 3000) {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = "";
  let beats = 0;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => { if (timer) clearTimeout(timer); try { controller.close(); } catch { /* already closed */ } };
      signal.addEventListener("abort", close, { once: true });
      controller.enqueue(enc.encode(`retry: 3000\n\n`));
      const tick = async () => {
        if (signal.aborted) return;
        try {
          const snap = await buildSnapshot(db);
          if (snap.version !== last) {
            last = snap.version;
            controller.enqueue(enc.encode(`event: snapshot\nid: ${snap.version}\ndata: ${JSON.stringify(snap)}\n\n`));
          } else if (++beats % 5 === 0) controller.enqueue(enc.encode(`: keep-alive\n\n`));
        } catch (e) {
          controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ message: (e as Error).message.slice(0, 200) })}\n\n`));
        }
        if (!signal.aborted) timer = setTimeout(tick, intervalMs);
      };
      await tick();
    },
    cancel() { if (timer) clearTimeout(timer); },
  });
}
