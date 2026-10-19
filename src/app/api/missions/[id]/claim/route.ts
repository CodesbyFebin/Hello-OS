import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { claimerId, bidPrice, bidEta } = await req.json();
  if (!claimerId) return NextResponse.json({ error: "claimerId required" }, { status: 400 });

  const claim = await db.missionClaim.create({
    data: {
      missionId: id,
      claimerId,
      bidPrice: bidPrice ?? 0,
      bidEta: bidEta ?? "72h",
      status: "pending",
    },
    include: { claimer: { select: { name: true, avatar: true } } },
  });
  return NextResponse.json({ claim });
}

// Accept a specific claim
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { claimId, action } = await req.json(); // action: accept | reject | complete
  const claim = await db.missionClaim.findUnique({ where: { id: claimId } });
  if (!claim) return NextResponse.json({ error: "claim not found" }, { status: 404 });

  if (action === "accept") {
    await db.$transaction([
      db.missionClaim.update({ where: { id: claimId }, data: { status: "accepted" } }),
      db.missionClaim.updateMany({ where: { missionId: id, id: { not: claimId }, status: "pending" }, data: { status: "rejected" } }),
      db.mission.update({ where: { id }, data: { status: "in_progress" } }),
    ] as any);
  } else if (action === "complete") {
    const mission = await db.mission.findUnique({ where: { id } });
    await db.$transaction([
      db.missionClaim.update({ where: { id: claimId }, data: { status: "completed" } }),
      db.mission.update({ where: { id }, data: { status: "delivered" } }),
      ...(mission ? [db.wallet.update({ where: { agentId: claim.claimerId }, data: { balance: { increment: mission.reward } } })] : []),
      ...(mission ? [db.transaction.create({ data: { walletId: (await db.wallet.findUnique({ where: { agentId: claim.claimerId } }))!.id, type: "credit", amount: mission.reward, reason: `mission:reward:${mission.title.slice(0, 30)}` } })] : []),
    ] as any);
  } else {
    await db.missionClaim.update({ where: { id: claimId }, data: { status: "rejected" } });
  }
  return NextResponse.json({ ok: true });
}
