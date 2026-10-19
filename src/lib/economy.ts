import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type SpendResult<T = undefined> =
  | { ok: true; wallet: NonNullable<Awaited<ReturnType<typeof db.wallet.findUnique>>>; extra: T }
  | { ok: false; status: 404 | 402 | 423 | 429 | 409; error: string; wallet?: Awaited<ReturnType<typeof db.wallet.findUnique>> };

/** Atomically enforces wallet state, available funds and the daily spend cap.
 * A cap breach trips the circuit and creates a blocked audit entry. Optional
 * side effects run in the same transaction, so failed installs cannot debit.
 */
export async function spendWallet<T = undefined>(
  agentId: string,
  amount: number,
  reason: string,
  traceId?: string,
  sideEffect?: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<SpendResult<T>> {
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, status: 402, error: "amount must be a non-negative finite number" };
  }

  return db.$transaction(async (tx) => {
    const found = await tx.wallet.findUnique({ where: { agentId } });
    if (!found) return { ok: false, status: 404, error: "wallet not found" } as const;
    const today = new Date().toISOString().slice(0, 10);
    const wallet = found.spentOn === today ? found : await tx.wallet.update({ where: { id: found.id }, data: { spentToday: 0, spentOn: today } });
    if (wallet.circuitOpen) return { ok: false, status: 423, error: "wallet circuit breaker is open", wallet } as const;
    if (wallet.balance < amount) return { ok: false, status: 402, error: "insufficient balance", wallet } as const;

    if (wallet.spentToday + amount > wallet.dailyCap) {
      await tx.wallet.update({ where: { id: wallet.id }, data: { circuitOpen: true } });
      await tx.transaction.create({
        data: { walletId: wallet.id, type: "blocked", amount, reason: `circuit_breaker:daily_cap:${reason}`, traceId },
      });
      return { ok: false, status: 429, error: "daily spend cap exceeded; circuit breaker opened", wallet: { ...wallet, circuitOpen: true } } as const;
    }

    const reserved = await tx.wallet.updateMany({
      where: {
        agentId,
        circuitOpen: false,
        balance: { gte: amount },
        spentToday: { lte: wallet.dailyCap - amount },
      },
      data: { balance: { decrement: amount }, spentToday: { increment: amount } },
    });
    if (reserved.count !== 1) {
      const latest = await tx.wallet.findUnique({ where: { agentId } });
      if (latest && latest.spentToday + amount > latest.dailyCap && !latest.circuitOpen) {
        await tx.wallet.update({ where: { id: latest.id }, data: { circuitOpen: true } });
        await tx.transaction.create({ data: { walletId: latest.id, type: "blocked", amount, reason: `circuit_breaker:concurrent_cap:${reason}`, traceId } });
        return { ok: false, status: 429, error: "daily spend cap exceeded; circuit breaker opened", wallet: { ...latest, circuitOpen: true } } as const;
      }
      return { ok: false, status: latest?.circuitOpen ? 423 : 409, error: latest?.circuitOpen ? "wallet circuit breaker is open" : "wallet changed; retry the spend", wallet: latest } as const;
    }

    const updated = await tx.wallet.findUniqueOrThrow({ where: { agentId } });
    await tx.transaction.create({ data: { walletId: wallet.id, type: "debit", amount, reason, traceId } });
    const extra = sideEffect ? await sideEffect(tx) : undefined as T;
    return { ok: true, wallet: updated, extra } as const;
  });
}
