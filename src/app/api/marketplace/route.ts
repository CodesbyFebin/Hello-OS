import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";

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
  const manifest = {
    authorId,
    name,
    description: description || "",
    category: category || "prompt",
    price: price ?? 0,
    version: "1.0.0",
  };
  const skill = await db.skill.create({
    data: {
      ...manifest,
      // No eval has been run for a freshly published skill, so its score is 0
      // ("unevaluated") until a real evaluation writes one.
      genomeScore: 0,
      // sha256 of the canonical manifest JSON (key-sorted).
      manifestHash: createHash("sha256").update(JSON.stringify(manifest, Object.keys(manifest).sort())).digest("hex"),
    },
  });
  return NextResponse.json({ skill });
}
