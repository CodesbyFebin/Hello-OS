// Reversibility & approval gate. Every agent action that can spend credits,
// delete data or reach outside the box is classified by risk and either
// allowed, queued for operator approval, or blocked by the kill switch.
import { db } from "@/lib/db";

export type RiskTier = "low" | "medium" | "high" | "critical";
export type GatedAction = "data.read" | "wallet.spend" | "skill.install" | "external.send" | "data.delete";
export type GateDecision =
  | { decision: "allow"; tier: RiskTier }
  | { decision: "pending"; tier: RiskTier; approvalId: string }
  | { decision: "blocked"; tier: RiskTier; reason: string };

export const ACTIONS: GatedAction[] = ["data.read", "wallet.spend", "skill.install", "external.send", "data.delete"];

/** Pure risk classification. Reversible, internal actions are low; spends are
 * medium until they cross the operator threshold; irreversible or externally
 * visible actions are always critical. */
export function classifyRisk(action: GatedAction, amount: number, threshold: number): RiskTier {
  if (action === "data.read") return "low";
  if (action === "external.send" || action === "data.delete") return "critical";
  return amount > threshold ? "high" : "medium";
}

export function needsApproval(tier: RiskTier) { return tier === "high" || tier === "critical"; }

export async function getControl() {
  return db.operatorControl.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
}

export async function audit(actor: string, action: string, target = "", detail = "") {
  await db.auditLog.create({ data: { actor, action, target, detail: detail.slice(0, 500) } });
}

/** Decide whether an agent action may run now. Queues an ActionApproval when needed. */
export async function gate(agentId: string, action: GatedAction, amount: number, payload: Record<string, unknown>): Promise<GateDecision> {
  const control = await getControl();
  const tier = classifyRisk(action, amount, control.approvalThreshold);
  if (control.killSwitch) {
    await audit(agentId, `gate.blocked:${action}`, "", `kill switch on; amount=${amount}`);
    return { decision: "blocked", tier, reason: "operator kill switch is on" };
  }
  if (!needsApproval(tier)) {
    await audit(agentId, `gate.allow:${action}`, "", `tier=${tier}; amount=${amount}`);
    return { decision: "allow", tier };
  }
  const approval = await db.actionApproval.create({ data: { agentId, action, riskTier: tier, amount, payload: JSON.stringify(payload).slice(0, 4000) } });
  await audit(agentId, `gate.queued:${action}`, approval.id, `tier=${tier}; amount=${amount}`);
  return { decision: "pending", tier, approvalId: approval.id };
}

/** Operator auth. If HELLO_OPERATOR_TOKEN is set, the x-operator-token header must match.
 * If it is unset (local dev) requests are allowed and the response says so. */
export function operatorCheck(req: Request): { ok: boolean; devMode: boolean } {
  const expected = process.env.HELLO_OPERATOR_TOKEN;
  if (!expected) return { ok: true, devMode: true };
  return { ok: req.headers.get("x-operator-token") === expected, devMode: false };
}

/** Operator decision on a queued action. Approved spends/installs are executed
 * through the same code paths as ungated calls (caps and circuit breaker still apply). */
export async function decide(approvalId: string, decision: "approve" | "reject", operator: string, note = "") {
  const { spendWallet } = await import("@/lib/economy");
  const { installSkill } = await import("@/lib/skills");
  const claimed = await db.actionApproval.updateMany({
    where: { id: approvalId, status: "pending" },
    data: { status: decision === "approve" ? "approved" : "rejected", decidedBy: operator, decidedAt: new Date(), note: note.slice(0, 300) },
  });
  if (claimed.count !== 1) return { ok: false as const, status: 409, error: "approval not found or already decided" };
  await audit("operator", `approval.${decision}`, approvalId, note);
  const a = await db.actionApproval.findUniqueOrThrow({ where: { id: approvalId } });
  if (decision === "reject") return { ok: true as const, approval: a };
  if ((await getControl()).killSwitch) {
    const failed = await db.actionApproval.update({ where: { id: a.id }, data: { status: "failed", note: "kill switch on at execution time" } });
    return { ok: true as const, approval: failed };
  }

  const p = JSON.parse(a.payload) as Record<string, string | number | undefined>;
  let outcome: { ok: boolean; error?: string };
  if (a.action === "wallet.spend") {
    const r = await spendWallet(String(p.agentId), Number(p.amount), String(p.reason ?? "approved_spend"), p.traceId ? String(p.traceId) : undefined);
    outcome = r.ok ? { ok: true } : { ok: false, error: r.error };
  } else if (a.action === "skill.install") {
    const r = await installSkill(String(p.agentId), String(p.skillId));
    outcome = r.ok ? { ok: true } : { ok: false, error: r.error };
  } else {
    outcome = { ok: false, error: "no executor wired for this action in the prototype; recorded only" };
  }
  const updated = await db.actionApproval.update({ where: { id: a.id }, data: { status: outcome.ok ? "executed" : "failed", note: outcome.error ?? a.note } });
  await audit("system", `approval.${updated.status}`, a.id, outcome.error ?? "");
  return { ok: true as const, approval: updated };
}
