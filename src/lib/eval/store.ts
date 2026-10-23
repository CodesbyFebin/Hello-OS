// Persistence for evaluation runs and promotions. Promotion is two-step:
// requestPromotion() checks the recorded evidence; approvePromotion() needs a
// named human approver and only succeeds for an eligible request. Every
// decision is kept, and the previous champion is recorded for rollback.
import { db } from "@/lib/db";
import { compare, type EvalRunRecord } from "./core";

export async function saveRun(r: EvalRunRecord) {
  return db.evalRun.create({
    data: {
      suiteId: r.suiteId, suiteVersion: r.suiteVersion, suiteHash: r.suiteHash, fingerprint: r.fingerprint,
      candidateId: r.candidate.id, revision: r.candidate.revision, promptVersion: r.candidate.promptVersion,
      provider: r.candidate.provider, model: r.candidate.model, configJson: JSON.stringify(r.candidate.config),
      resultsJson: JSON.stringify(r.results), summaryJson: JSON.stringify(r.summary),
      requiredPassed: r.summary.requiredPassed, requiredTotal: r.summary.requiredTotal, safetyViolations: r.summary.safetyViolations,
      startedAt: new Date(r.startedAt), finishedAt: new Date(r.finishedAt),
    },
  });
}

export function toRecord(row: Awaited<ReturnType<typeof saveRun>>): EvalRunRecord {
  return {
    suiteId: row.suiteId, suiteVersion: row.suiteVersion, suiteHash: row.suiteHash, fingerprint: row.fingerprint,
    candidate: { id: row.candidateId, revision: row.revision, promptVersion: row.promptVersion, provider: row.provider, model: row.model, config: JSON.parse(row.configJson) },
    startedAt: row.startedAt.toISOString(), finishedAt: row.finishedAt.toISOString(),
    results: JSON.parse(row.resultsJson), summary: JSON.parse(row.summaryJson),
  };
}

export async function currentChampion(suiteId: string) {
  const p = await db.evalPromotion.findFirst({ where: { suiteId, status: "approved" }, orderBy: { decidedAt: "desc" } });
  return p ? db.evalRun.findUnique({ where: { id: p.candidateRunId } }) : null;
}

export async function requestPromotion(candidateRunId: string, requestedBy: string) {
  const cand = await db.evalRun.findUnique({ where: { id: candidateRunId } });
  if (!cand) return { ok: false as const, status: 404, error: "eval run not found" };
  const champ = await currentChampion(cand.suiteId);
  const cmp = compare(champ ? toRecord(champ) : null, toRecord(cand));
  const p = await db.evalPromotion.create({
    data: {
      suiteId: cand.suiteId, candidateRunId: cand.id, baselineRunId: champ?.id ?? null,
      status: cmp.eligible ? "pending" : "blocked", requestedBy, reasonsJson: JSON.stringify(cmp),
    },
  });
  await db.auditLog.create({ data: { actor: requestedBy, action: "eval.promotion.request", target: p.id, detail: JSON.stringify({ candidateRunId, eligible: cmp.eligible, reasons: cmp.reasons }) } });
  return { ok: true as const, promotion: p, comparison: cmp };
}

export async function decidePromotion(promotionId: string, approver: string, decision: "approve" | "reject") {
  const who = approver.trim();
  if (!who) return { ok: false as const, status: 400, error: "a named human approver is required" };
  const p = await db.evalPromotion.findUnique({ where: { id: promotionId } });
  if (!p) return { ok: false as const, status: 404, error: "promotion not found" };
  if (p.status !== "pending") return { ok: false as const, status: 409, error: `promotion is ${p.status}; only pending requests can be decided` };
  if (decision === "approve") {
    // Re-check: the champion may have changed since the request.
    const champ = await currentChampion(p.suiteId);
    if ((champ?.id ?? null) !== p.baselineRunId) return { ok: false as const, status: 409, error: "champion changed since request; request again" };
  }
  const updated = await db.evalPromotion.update({
    where: { id: p.id },
    data: { status: decision === "approve" ? "approved" : "rejected", approvedBy: who, decidedAt: new Date(), previousChampionRunId: p.baselineRunId },
  });
  await db.auditLog.create({ data: { actor: who, action: `eval.promotion.${decision}`, target: p.id, detail: JSON.stringify({ candidateRunId: p.candidateRunId, previousChampionRunId: p.baselineRunId }) } });
  return { ok: true as const, promotion: updated };
}

/** Roll back an approved promotion; the previous champion becomes current again. */
export async function rollbackPromotion(promotionId: string, actor: string) {
  const who = actor.trim();
  if (!who) return { ok: false as const, status: 400, error: "a named human actor is required" };
  const p = await db.evalPromotion.findUnique({ where: { id: promotionId } });
  if (!p || p.status !== "approved") return { ok: false as const, status: 409, error: "only an approved promotion can be rolled back" };
  const updated = await db.evalPromotion.update({ where: { id: p.id }, data: { status: "rolled_back" } });
  await db.auditLog.create({ data: { actor: who, action: "eval.promotion.rollback", target: p.id, detail: JSON.stringify({ restored: p.previousChampionRunId }) } });
  return { ok: true as const, promotion: updated };
}
