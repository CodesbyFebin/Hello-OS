import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardWrite, idempotent, principalScope } from "@/lib/guard";

// Bid on a mission (as the claiming agent).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardWrite(req, { bucket: "missions", agents: (b) => [String(b.claimerId ?? "")] });
  if (!g.ok) return g.response;
  return idempotent(req, `claim:${id}:${principalScope(g.principal)}`, g.text, async () => {
    const { claimerId, bidPrice, bidEta } = g.json;
    if (typeof claimerId !== "string" || !claimerId) return NextResponse.json({ error: "claimerId required" }, { status: 400 });
    const price = bidPrice === undefined ? 0 : Number(bidPrice);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return NextResponse.json({ error: "bidPrice must be 0..1000000 H" }, { status: 400 });
    if (bidEta !== undefined && (typeof bidEta !== "string" || bidEta.length > 20)) return NextResponse.json({ error: "bidEta must be at most 20 characters" }, { status: 400 });
    const mission = await db.mission.findUnique({ where: { id } });
    if (!mission) return NextResponse.json({ error: "mission not found" }, { status: 404 });
    if (mission.status !== "open") return NextResponse.json({ error: `mission is ${mission.status}` }, { status: 409 });
    if (mission.posterId === claimerId) return NextResponse.json({ error: "the poster cannot claim its own mission" }, { status: 409 });
    if (!(await db.agent.findUnique({ where: { id: claimerId }, select: { id: true } }))) return NextResponse.json({ error: "claimer agent not found" }, { status: 404 });
    const claim = await db.missionClaim.create({
      data: { missionId: id, claimerId, bidPrice: price, bidEta: bidEta ?? "72h", status: "pending" },
      include: { claimer: { select: { name: true, avatar: true } } },
    });
    return NextResponse.json({ claim });
  });
}

// Accept / reject / complete a claim. Only the mission's poster (or the operator).
// Completing pays the reward from the poster's wallet; credits are not created.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mission = await db.mission.findUnique({ where: { id } });
  if (!mission) return NextResponse.json({ error: "mission not found" }, { status: 404 });
  const g = await guardWrite(req, { bucket: "missions", agents: [mission.posterId] });
  if (!g.ok) return g.response;
  return idempotent(req, `claim-decide:${id}:${principalScope(g.principal)}`, g.text, async () => {
    const { claimId, action } = g.json;
    if (!["accept", "reject", "complete"].includes(action)) return NextResponse.json({ error: "action must be accept, reject or complete" }, { status: 400 });
    const claim = typeof claimId === "string" ? await db.missionClaim.findUnique({ where: { id: claimId } }) : null;
    if (!claim || claim.missionId !== id) return NextResponse.json({ error: "claim not found for this mission" }, { status: 404 });

    if (action === "accept") {
      if (claim.status !== "pending" || mission.status !== "open") return NextResponse.json({ error: "only a pending claim on an open mission can be accepted" }, { status: 409 });
      await db.$transaction([
        db.missionClaim.update({ where: { id: claim.id }, data: { status: "accepted" } }),
        db.missionClaim.updateMany({ where: { missionId: id, id: { not: claim.id }, status: "pending" }, data: { status: "rejected" } }),
        db.mission.update({ where: { id }, data: { status: "in_progress" } }),
      ]);
    } else if (action === "complete") {
      if (claim.status !== "accepted") return NextResponse.json({ error: "only an accepted claim can be completed" }, { status: 409 });
      const [from, to] = await Promise.all([db.wallet.findUnique({ where: { agentId: mission.posterId } }), db.wallet.findUnique({ where: { agentId: claim.claimerId } })]);
      if (mission.reward > 0 && (!from || !to)) return NextResponse.json({ error: "poster or claimer has no wallet" }, { status: 409 });
      if (mission.reward > 0 && from!.balance < mission.reward) return NextResponse.json({ error: "poster balance is below the reward", code: "INSUFFICIENT_FUNDS" }, { status: 409 });
      await db.$transaction(async (tx) => {
        await tx.missionClaim.update({ where: { id: claim.id }, data: { status: "completed" } });
        await tx.mission.update({ where: { id }, data: { status: "delivered" } });
        if (mission.reward > 0) {
          const debited = await tx.wallet.updateMany({ where: { id: from!.id, balance: { gte: mission.reward } }, data: { balance: { decrement: mission.reward } } });
          if (!debited.count) throw new Error("INSUFFICIENT_FUNDS");
          await tx.wallet.update({ where: { id: to!.id }, data: { balance: { increment: mission.reward } } });
          const note = `mission:reward:${mission.title.slice(0, 30)}`;
          await tx.transaction.create({ data: { walletId: from!.id, type: "debit", amount: mission.reward, reason: note } });
          await tx.transaction.create({ data: { walletId: to!.id, type: "credit", amount: mission.reward, reason: note } });
        }
      });
    } else {
      if (claim.status === "completed") return NextResponse.json({ error: "a completed claim cannot be rejected" }, { status: 409 });
      await db.missionClaim.update({ where: { id: claim.id }, data: { status: "rejected" } });
    }
    return NextResponse.json({ ok: true });
  });
}
