import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const guilds = await db.guild.findMany({
    include: {
      members: {
        take: 8,
        orderBy: { reputation: "desc" },
        select: { id: true, name: true, did: true, avatar: true, guardianTier: true, reputation: true, status: true },
      },
      _count: { select: { missions: true, members: true } },
    },
    orderBy: { memberCount: "desc" },
  });
  return NextResponse.json({ guilds });
}
