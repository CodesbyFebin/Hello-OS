import { NextResponse } from "next/server";
import { spendWallet } from "@/lib/economy";
import { gate } from "@/lib/gate";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be a positive finite number" }, { status: 400 });
  const reason = String(body.reason || "agent_spend").slice(0, 180);
  const traceId = typeof body.traceId === "string" ? body.traceId.slice(0, 100) : undefined;

  const g = await gate(id, "wallet.spend", amount, { agentId: id, amount, reason, traceId });
  if (g.decision === "blocked") return NextResponse.json({ error: g.reason, tier: g.tier }, { status: 423 });
  if (g.decision === "pending") return NextResponse.json({ status: "pending_approval", approvalId: g.approvalId, tier: g.tier }, { status: 202 });

  const result = await spendWallet(id, amount, reason, traceId);
  if (!result.ok) return NextResponse.json({ error: result.error, wallet: result.wallet }, { status: result.status });
  return NextResponse.json({ wallet: result.wallet, spent: amount, traceId: body.traceId ?? null, tier: g.tier });
}
