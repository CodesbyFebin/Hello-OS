import { NextResponse } from "next/server";
import { spendWallet } from "@/lib/economy";
import { gate } from "@/lib/gate";
import { guardWrite, idempotent, principalScope } from "@/lib/guard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardWrite(req, { bucket: "spend", agents: [id] });
  if (!g.ok) return g.response;
  const body = g.json;
  return idempotent(req, `spend:${id}:${principalScope(g.principal)}`, g.text, async () => {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return NextResponse.json({ error: "amount must be >0 and <= 1000000 H" }, { status: 400 });
  const reason = String(body.reason || "agent_spend").slice(0, 180);
  const traceId = typeof body.traceId === "string" ? body.traceId.slice(0, 100) : undefined;

  const gt = await gate(id, "wallet.spend", amount, { agentId: id, amount, reason, traceId });
  if (gt.decision === "blocked") return NextResponse.json({ error: gt.reason, tier: gt.tier }, { status: 423 });
  if (gt.decision === "pending") return NextResponse.json({ status: "pending_approval", approvalId: gt.approvalId, tier: gt.tier }, { status: 202 });

  const result = await spendWallet(id, amount, reason, traceId);
  if (!result.ok) return NextResponse.json({ error: result.error, wallet: result.wallet }, { status: result.status });
  return NextResponse.json({ wallet: result.wallet, spent: amount, traceId: body.traceId ?? null, tier: gt.tier });
  });
}
