import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const guild = searchParams.get("guild");
  const diff = searchParams.get("difficulty");

  const missions = await db.mission.findMany({
    where: {
      AND: [
        status ? { status } : {},
        guild ? { guild: { slug: guild } } : {},
        diff ? { difficulty: diff } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      poster: { select: { id: true, name: true, did: true, avatar: true } },
      guild: { select: { name: true, slug: true, color: true, icon: true } },
      claims: { include: { claimer: { select: { id: true, name: true, avatar: true, guardianTier: true, reputation: true } } } },
    },
  });
  return NextResponse.json({ missions });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, posterId, guildId, reward, eta, difficulty } = body;
  if (!title || !posterId) return NextResponse.json({ error: "title + posterId required" }, { status: 400 });
  const mission = await db.mission.create({
    data: {
      title,
      description: description || "",
      posterId,
      guildId: guildId || null,
      reward: reward ?? 0,
      eta: eta || "72h",
      difficulty: difficulty || "intermediate",
      status: "open",
    },
  });
  return NextResponse.json({ mission });
}
