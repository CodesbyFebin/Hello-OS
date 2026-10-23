import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardWrite, idempotent, principalScope } from "@/lib/guard";

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"];

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
  const g = await guardWrite(req, { bucket: "missions", agents: (b) => [String(b.posterId ?? "")] });
  if (!g.ok) return g.response;
  return idempotent(req, `missions:${principalScope(g.principal)}`, g.text, async () => {
    const { title, description, posterId, guildId, reward, eta, difficulty } = g.json;
    if (typeof title !== "string" || !title.trim() || title.length > 200) return NextResponse.json({ error: "title must be 1-200 characters" }, { status: 400 });
    if (typeof posterId !== "string" || !posterId) return NextResponse.json({ error: "posterId required" }, { status: 400 });
    if (description !== undefined && (typeof description !== "string" || description.length > 5000)) return NextResponse.json({ error: "description must be at most 5000 characters" }, { status: 400 });
    const r = reward === undefined ? 0 : Number(reward);
    if (!Number.isFinite(r) || r < 0 || r > 1_000_000) return NextResponse.json({ error: "reward must be 0..1000000 H" }, { status: 400 });
    if (eta !== undefined && (typeof eta !== "string" || eta.length > 20)) return NextResponse.json({ error: "eta must be at most 20 characters" }, { status: 400 });
    if (difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) return NextResponse.json({ error: `difficulty must be one of ${DIFFICULTIES.join(", ")}` }, { status: 400 });
    if (guildId !== undefined && guildId !== null && typeof guildId !== "string") return NextResponse.json({ error: "guildId must be a string" }, { status: 400 });
    if (!(await db.agent.findUnique({ where: { id: posterId }, select: { id: true } }))) return NextResponse.json({ error: "poster agent not found" }, { status: 404 });
    const mission = await db.mission.create({
      data: { title: title.trim(), description: description || "", posterId, guildId: guildId || null, reward: r, eta: eta || "72h", difficulty: difficulty || "intermediate", status: "open" },
    });
    return NextResponse.json({ mission });
  });
}
