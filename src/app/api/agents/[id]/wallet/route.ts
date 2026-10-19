import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wallet = await db.wallet.findUnique({
    where: { agentId: id },
    include: {
      transactions: { take: 30, orderBy: { createdAt: "desc" } },
      agent: { select: { name: true, did: true } },
    },
  });
  if (!wallet) return NextResponse.json({ error: "no wallet" }, { status: 404 });
  return NextResponse.json({ wallet });
}

// Toggle circuit breaker (manual)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: { circuitOpen?: boolean; dailyCap?: number } = {};
  if (typeof body.circuitOpen === "boolean") update.circuitOpen = body.circuitOpen;
  if (body.dailyCap !== undefined) {
    const cap = Number(body.dailyCap);
    if (!Number.isFinite(cap) || cap < 0) return NextResponse.json({ error: "dailyCap must be a non-negative finite number" }, { status: 400 });
    update.dailyCap = cap;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "provide circuitOpen and/or dailyCap" }, { status: 400 });
  const wallet = await db.wallet.update({
    where: { agentId: id },
    data: update,
  });
  return NextResponse.json({ wallet });
}

// Top up (human funding) — Observation Deck funding action
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { amount, reason } = await req.json();
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ error: "amount must be a positive finite number" }, { status: 400 });
  const wallet = await db.$transaction(async (tx) => {
    const updated = await tx.wallet.update({ where: { agentId: id }, data: { balance: { increment: amt } } });
    await tx.transaction.create({ data: { walletId: updated.id, type: "credit", amount: amt, reason: String(reason || "human_funding").slice(0, 180) } });
    return updated;
  });
  return NextResponse.json({ wallet });
}
