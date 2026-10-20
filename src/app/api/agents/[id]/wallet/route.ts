import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { operatorAuth, operatorDenied } from "@/lib/operator-auth";

const MAX_CREDITS = 1_000_000; // H; input bound, not a business limit

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

// Operator-only: toggle circuit breaker or change the daily cap.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = operatorAuth(req); if (!op.ok) return operatorDenied(op);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: { circuitOpen?: boolean; dailyCap?: number } = {};
  if (typeof body.circuitOpen === "boolean") update.circuitOpen = body.circuitOpen;
  if (body.dailyCap !== undefined) {
    const cap = Number(body.dailyCap);
    if (!Number.isFinite(cap) || cap < 0 || cap > MAX_CREDITS) return NextResponse.json({ error: `dailyCap must be 0..${MAX_CREDITS} H` }, { status: 400 });
    update.dailyCap = cap;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "provide circuitOpen and/or dailyCap" }, { status: 400 });
  const existing = await db.wallet.findUnique({ where: { agentId: id } });
  if (!existing) return NextResponse.json({ error: "no wallet" }, { status: 404 });
  const wallet = await db.wallet.update({ where: { agentId: id }, data: update });
  await db.auditLog.create({ data: { actor: op.devMode ? "operator (dev mode)" : "operator", action: "wallet.update", target: id, detail: JSON.stringify(update) } });
  return NextResponse.json({ wallet });
}

// Operator-only top up (human funding) — Observation Deck funding action
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = operatorAuth(req); if (!op.ok) return operatorDenied(op);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "body must be a JSON object" }, { status: 400 });
  const { amount, reason } = body as { amount?: unknown; reason?: unknown };
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0 || amt > MAX_CREDITS) return NextResponse.json({ error: `amount must be >0 and <= ${MAX_CREDITS} H` }, { status: 400 });
  if (!(await db.wallet.findUnique({ where: { agentId: id } }))) return NextResponse.json({ error: "no wallet" }, { status: 404 });
  const wallet = await db.$transaction(async (tx) => {
    const updated = await tx.wallet.update({ where: { agentId: id }, data: { balance: { increment: amt } } });
    await tx.transaction.create({ data: { walletId: updated.id, type: "credit", amount: amt, reason: String(reason || "human_funding").slice(0, 180) } });
    return updated;
  });
  return NextResponse.json({ wallet });
}
