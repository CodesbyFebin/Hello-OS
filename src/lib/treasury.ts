// Treasury reallocation: move prototype credits from one agent wallet to
// another. Requests pass the approval gate (large moves need an operator);
// execution debits through spendWallet, so the source's daily cap and
// circuit breaker still apply.
import { db } from "@/lib/db";
import { spendWallet } from "@/lib/economy";
import { gate } from "@/lib/gate";

export async function requestReallocation(fromAgentId: string, toAgentId: string, amount: number, reason: string) {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const, status: 400, error: "amount must be > 0" };
  if (fromAgentId === toAgentId) return { ok: false as const, status: 400, error: "source and target must differ" };
  const target = await db.wallet.findUnique({ where: { agentId: toAgentId } });
  if (!target) return { ok: false as const, status: 404, error: "target wallet not found" };
  const g = await gate(fromAgentId, "treasury.reallocate", amount, { fromAgentId, toAgentId, amount, reason });
  if (g.decision === "blocked") return { ok: false as const, status: 423, error: g.reason };
  if (g.decision === "pending") return { ok: true as const, status: 202, pending: true, approvalId: g.approvalId, tier: g.tier };
  const r = await executeReallocation(fromAgentId, toAgentId, amount, reason);
  return r.ok ? { ok: true as const, status: 200, pending: false, tier: g.tier } : { ok: false as const, status: 409, error: r.error };
}

export async function executeReallocation(fromAgentId: string, toAgentId: string, amount: number, reason: string) {
  const target = await db.wallet.findUnique({ where: { agentId: toAgentId } });
  if (!target) return { ok: false as const, error: "target wallet not found" };
  const r = await spendWallet(fromAgentId, amount, `treasury:reallocate:${toAgentId}:${reason}`.slice(0, 180), undefined, async (tx) => {
    await tx.wallet.update({ where: { id: target.id }, data: { balance: { increment: amount } } });
    await tx.transaction.create({ data: { walletId: target.id, type: "credit", amount, reason: `treasury:reallocate:from:${fromAgentId}`.slice(0, 180) } });
  });
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}