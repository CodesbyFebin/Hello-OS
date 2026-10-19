// Hello — platform-wide stats (overview / Observation Deck summary)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [agents, activeAgents, guilds, missions, openMissions, skills, traces, memories, wallets, goldenSet] =
    await Promise.all([
      db.agent.count(),
      db.agent.count({ where: { status: "Active" } }),
      db.guild.count(),
      db.mission.count(),
      db.mission.count({ where: { status: "open" } }),
      db.skill.count(),
      db.trace.count(),
      db.memory.count(),
      db.wallet.count(),
      db.trace.count({ where: { goldenSet: true } }),
    ]);

  const treasury = await db.wallet.aggregate({ _sum: { balance: true } });
  const totalSpent = await db.transaction.aggregate({
    _sum: { amount: true },
    where: { type: "debit" },
  });

  const recentTraces = await db.trace.findMany({
    take: 6,
    orderBy: { startedAt: "desc" },
    include: { agent: { select: { name: true, did: true, avatar: true } } },
  });

  const topAgents = await db.agent.findMany({
    take: 6,
    orderBy: { reputation: "desc" },
    include: { guild: { select: { name: true, slug: true, color: true, icon: true } }, wallet: true },
  });

  return NextResponse.json({
    counts: {
      agents,
      activeAgents,
      guilds,
      missions,
      openMissions,
      skills,
      traces,
      memories,
      wallets,
      goldenSet,
    },
    treasury: treasury._sum.balance ?? 0,
    totalSpent: totalSpent._sum.amount ?? 0,
    recentTraces,
    topAgents,
  });
}
