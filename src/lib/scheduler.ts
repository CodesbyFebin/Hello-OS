// Heartbeat scheduler. Jobs are rows in ScheduledJob; `tick()` runs every job
// whose nextRunAt has passed. Ticks come from POST /api/scheduler/tick (call it
// from system cron, a CI schedule, or the Ops page's auto-tick toggle).
import { db } from "@/lib/db";

export const JOB_KINDS = ["heartbeat", "wallet.audit", "missions.stale"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/** Each job reads real state from the local database and returns a summary. */
export async function runJobKind(kind: string, agentId: string | null): Promise<Record<string, unknown>> {
  if (kind === "heartbeat") {
    const agent = agentId ? await db.agent.findUnique({ where: { id: agentId }, select: { name: true, status: true } }) : null;
    return { alive: true, agent: agent?.name ?? null, status: agent?.status ?? null };
  }
  if (kind === "wallet.audit") {
    const wallets = await db.wallet.findMany({ where: agentId ? { agentId } : {}, select: { agentId: true, balance: true, spentToday: true, dailyCap: true, circuitOpen: true } });
    const nearCap = wallets.filter((w) => w.dailyCap > 0 && w.spentToday / w.dailyCap >= 0.8).map((w) => w.agentId);
    return { wallets: wallets.length, circuitOpen: wallets.filter((w) => w.circuitOpen).length, nearDailyCap: nearCap.length, lowBalance: wallets.filter((w) => w.balance < 5).length };
  }
  if (kind === "missions.stale") {
    const cutoff = new Date(Date.now() - 7 * 86400_000);
    const stale = await db.mission.count({ where: { status: "open", createdAt: { lt: cutoff } } });
    const open = await db.mission.count({ where: { status: "open" } });
    return { open, staleOver7Days: stale };
  }
  throw new Error(`unknown job kind: ${kind}`);
}

export async function tick(now = new Date()) {
  const due = await db.scheduledJob.findMany({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" }, take: 50 });
  const results: { jobId: string; name: string; ok: boolean; output: unknown }[] = [];
  for (const job of due) {
    // Claim the job first so concurrent ticks don't run it twice.
    const next = new Date(now.getTime() + job.intervalSec * 1000);
    const claimed = await db.scheduledJob.updateMany({ where: { id: job.id, nextRunAt: job.nextRunAt }, data: { nextRunAt: next } });
    if (claimed.count !== 1) continue;
    const t0 = Date.now();
    let ok = true; let output: unknown;
    try { output = await runJobKind(job.kind, job.agentId); } catch (e) { ok = false; output = { error: e instanceof Error ? e.message : String(e) }; }
    await db.jobRun.create({ data: { jobId: job.id, ok, output: JSON.stringify(output).slice(0, 4000), durationMs: Date.now() - t0 } });
    await db.scheduledJob.update({ where: { id: job.id }, data: { lastRunAt: now, lastOk: ok, runCount: { increment: 1 } } });
    results.push({ jobId: job.id, name: job.name, ok, output });
  }
  return { ranAt: now.toISOString(), due: due.length, results };
}
