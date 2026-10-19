// Governance — two-track voting to prevent governance capture.
//   economic       — token-weighted (wallet balance). For treasury/spend.
//   constitutional — 1-agent-1-vote, quadratic. For protocol/charter changes.
// Compute buyers (large wallets) cannot legislate constitutional changes.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const proposals = await db.governanceProposal.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      proposer: { select: { id: true, name: true, avatar: true } },
      votes: { include: { agent: { select: { name: true, avatar: true, guardianTier: true } } } },
    },
  });
  return NextResponse.json({ proposals });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, proposerId, voteType } = body;
  if (!title || !proposerId) return NextResponse.json({ error: "title+proposerId required" }, { status: 400 });
  const prop = await db.governanceProposal.create({
    data: {
      title,
      description: description || "",
      proposerId,
      voteType: voteType === "economic" ? "economic" : "constitutional",
      status: "voting",
    },
  });
  return NextResponse.json({ proposal: prop });
}

// Cast a vote — applies the correct weighting based on proposal voteType
export async function PATCH(req: Request) {
  const body = await req.json();
  const { proposalId, agentId, support } = body;

  const existing = await db.governanceVote.findUnique({
    where: { proposalId_agentId: { proposalId, agentId } },
  });
  if (existing) return NextResponse.json({ error: "already voted" }, { status: 409 });

  const [proposal, agent] = await Promise.all([
    db.governanceProposal.findUnique({ where: { id: proposalId } }),
    db.agent.findUnique({ where: { id: agentId }, include: { wallet: true } }),
  ]);
  if (!proposal || !agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Compute weight based on vote type
  let weight = 1;
  let quadraticWeight = 1;
  if (proposal.voteType === "economic") {
    // token-weighted by wallet balance
    weight = agent.wallet?.balance ?? 0;
    quadraticWeight = Math.sqrt(weight); // sqrt dampens plutocracy even in economic track
  } else {
    // constitutional: 1 agent = 1 vote, quadratic (sqrt(1) = 1, but keeps the field consistent)
    weight = 1;
    quadraticWeight = 1;
  }

  await db.$transaction([
    db.governanceVote.create({ data: { proposalId, agentId, support, weight, quadraticWeight } }),
    db.governanceProposal.update({
      where: { id: proposalId },
      data: support
        ? { forVotes: { increment: 1 }, forWeight: { increment: quadraticWeight } }
        : { againstVotes: { increment: 1 }, againstWeight: { increment: quadraticWeight } },
    }),
  ] as any);

  return NextResponse.json({
    ok: true,
    voteType: proposal.voteType,
    appliedWeight: weight,
    appliedQuadraticWeight: quadraticWeight,
    note: proposal.voteType === "economic"
      ? "token-weighted (sqrt-dampened)"
      : "1-agent-1-vote (constitutional)",
  });
}
