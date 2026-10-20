// Metered AI call: optional credit (H) debit through the wallet caps, plus an
// audit-log receipt (sha256 of request and response) for every call, ok or not.
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { spendWallet } from "@/lib/economy";
import { chat, resolveAIConfig, NoAIProviderError, AIRequestError, type ChatMessage, type ChatResult } from "./provider";

export const creditsPerCall = () => {
  const n = Number(process.env.HELLO_AI_CREDITS_PER_CALL);
  return Number.isFinite(n) && n >= 0 ? n : 1;
};

export class AIBudgetError extends Error {
  code = "AI_BUDGET_DENIED" as const;
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; this.name = "AIBudgetError"; }
}

const h = (s: string) => createHash("sha256").update(s).digest("hex");

export async function meteredChat(
  messages: ChatMessage[],
  ctx: { purpose: string; agentId?: string; actor?: string; maxTokens?: number },
): Promise<ChatResult & { receipt: string; credits: number }> {
  const r = resolveAIConfig();
  if (!r.ok) throw new NoAIProviderError(r.reason);
  const cost = ctx.agentId ? creditsPerCall() : 0;
  if (ctx.agentId && cost > 0) {
    const spend = await spendWallet(ctx.agentId, cost, `ai:${ctx.purpose}`);
    if (!spend.ok) throw new AIBudgetError(spend.error, spend.status);
  }
  const requestHash = h(JSON.stringify({ model: r.config.model, messages }));
  const actor = ctx.agentId ?? ctx.actor ?? "operator";
  try {
    const res = await chat(messages, { config: r.config, maxTokens: ctx.maxTokens });
    const receipt = h(`${requestHash}:${h(res.output)}`);
    await db.auditLog.create({ data: { actor, action: "ai.call", target: ctx.purpose, detail: JSON.stringify({ ok: true, provider: r.config.provider, model: res.model, requestHash, responseHash: h(res.output), receipt, latencyMs: res.latencyMs, attempts: res.attempts, usage: res.usage, credits: cost }) } });
    return { ...res, receipt, credits: cost };
  } catch (e: any) {
    await db.auditLog.create({ data: { actor, action: "ai.call", target: ctx.purpose, detail: JSON.stringify({ ok: false, provider: r.config.provider, model: r.config.model, requestHash, error: e?.code ?? "error", message: String(e?.message ?? e).slice(0, 200), credits: cost }) } });
    // Refund: a failed call does not consume credits.
    if (ctx.agentId && cost > 0) {
      const w = await db.wallet.findUnique({ where: { agentId: ctx.agentId } });
      if (w) await db.$transaction([
        db.wallet.update({ where: { id: w.id }, data: { balance: { increment: cost }, spentToday: { decrement: cost } } }),
        db.transaction.create({ data: { walletId: w.id, type: "credit", amount: cost, reason: `ai:${ctx.purpose}:refund_failed_call` } }),
      ]);
    }
    throw e;
  }
}

/** Map AI errors to HTTP responses for route handlers. */
export function aiErrorResponse(e: unknown): { status: number; body: { error: string; code: string } } | null {
  if (e instanceof NoAIProviderError) return { status: 503, body: { error: e.message, code: e.code } };
  if (e instanceof AIBudgetError) return { status: e.status, body: { error: e.message, code: e.code } };
  if (e instanceof AIRequestError) return { status: e.status, body: { error: e.message, code: e.code } };
  return null;
}

export { NoAIProviderError, AIRequestError };
