import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Lineage chain: ancestors + descendants of an agent
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: { parent: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true } } },
  });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Walk ancestors
  const ancestors: { id: string; name: string; did: string; avatar: string; guardianTier: string; relation: string }[] = [];
  let cur = agent;
  let depth = 0;
  while (cur.parent && depth < 10) {
    depth++;
    ancestors.push({ ...cur.parent, relation: `parent (${depth} gen up)` });
    cur = await db.agent.findUnique({
      where: { id: cur.parent.id },
      include: { parent: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true } } },
    }) as typeof cur;
    if (!cur) break;
  }

  // Descendants (1 level deep for performance)
  const children = await db.agent.findMany({
    where: { parentId: id },
    select: { id: true, name: true, did: true, avatar: true, guardianTier: true, reputation: true, createdAt: true },
  });

  return NextResponse.json({
    self: { id: agent.id, name: agent.name, did: agent.did, avatar: agent.avatar, guardianTier: agent.guardianTier },
    ancestors,
    children,
  });
}
