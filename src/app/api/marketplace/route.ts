import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const skills = await db.skill.findMany({
    where: {
      AND: [
        category ? { category } : {},
        q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {},
      ],
    },
    orderBy: { installs: "desc" },
    include: { author: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true } } },
  });
  return NextResponse.json({ skills });
}

// Publish a new skill
export async function POST(req: Request) {
  const body = await req.json();
  const { authorId, name, description, category, price } = body;
  if (!authorId || !name) return NextResponse.json({ error: "authorId + name required" }, { status: 400 });
  const skill = await db.skill.create({
    data: {
      authorId,
      name,
      description: description || "",
      category: category || "prompt",
      price: price ?? 0,
      genomeScore: 0.5 + Math.random() * 0.4,
      manifestHash: Math.random().toString(16).slice(2, 18),
    },
  });
  return NextResponse.json({ skill });
}
