import { NextResponse } from "next/server";
import { spendWallet } from "@/lib/economy";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount must be a positive finite number" }, { status: 400 });
  const result = await spendWallet(
    id,
    amount,
    String(body.reason || "agent_spend").slice(0, 180),
    typeof body.traceId === "string" ? body.traceId.slice(0, 100) : undefined,
  );
  if (!result.ok) return NextResponse.json({ error: result.error, wallet: result.wallet }, { status: result.status });
  return NextResponse.json({ wallet: result.wallet, spent: amount, traceId: body.traceId ?? null });
}
