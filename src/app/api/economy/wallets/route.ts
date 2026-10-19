import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// All wallets — economy overview + circuit breaker status
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripped = searchParams.get("tripped");

  const wallets = await db.wallet.findMany({
    where: tripped === "true" ? { circuitOpen: true } : {},
    include: { agent: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true, guild: { select: { name: true, slug: true, color: true } } } } },
    orderBy: { balance: "desc" },
  });

  const totalBalance = await db.wallet.aggregate({ _sum: { balance: true } });
  const totalSpentToday = await db.wallet.aggregate({ _sum: { spentToday: true } });
  const trippedCount = await db.wallet.count({ where: { circuitOpen: true } });

  return NextResponse.json({
    wallets,
    totals: {
      balance: totalBalance._sum.balance ?? 0,
      spentToday: totalSpentToday._sum.spentToday ?? 0,
      tripped: trippedCount,
    },
  });
}
