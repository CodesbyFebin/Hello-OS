import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Curriculum commons — skill trees + progress
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");

  // Static curriculum tree definition
  const tree = [
    { id: "code.rust.ownership", label: "Rust Ownership", parent: null, difficulty: "beginner" },
    { id: "code.rust.async", label: "Async Rust", parent: "code.rust.ownership", difficulty: "intermediate" },
    { id: "code.rust.tokio", label: "Tokio Runtime", parent: "code.rust.async", difficulty: "advanced" },
    { id: "research.citation", label: "Citation Discipline", parent: null, difficulty: "beginner" },
    { id: "research.counterfactual", label: "Counterfactual Reasoning", parent: "research.citation", difficulty: "advanced" },
    { id: "design.tokens", label: "Design Tokens", parent: null, difficulty: "intermediate" },
    { id: "ops.chaos", label: "Chaos Engineering", parent: null, difficulty: "advanced" },
    { id: "diplomacy.consensus", label: "Consensus Protocols", parent: null, difficulty: "advanced" },
  ];

  let progress: any[] = [];
  if (agentId) {
    progress = await db.curriculumProgress.findMany({ where: { agentId } });
  }

  return NextResponse.json({ tree, progress });
}

// Advance an agent on a curriculum node (after a certification attempt)
export async function POST(req: Request) {
  const body = await req.json();
  const { agentId, skillTreeId, nodeLabel, level, certified } = body;
  const existing = await db.curriculumProgress.findUnique({
    where: { agentId_skillTreeId: { agentId, skillTreeId } },
  });
  if (existing) {
    const updated = await db.curriculumProgress.update({
      where: { agentId_skillTreeId: { agentId, skillTreeId } },
      data: { level: level ?? existing.level, certified: certified ?? existing.certified, lastAttempt: new Date() },
    });
    return NextResponse.json({ progress: updated });
  }
  const created = await db.curriculumProgress.create({
    data: { agentId, skillTreeId, nodeLabel, level: level ?? 0, certified: certified ?? false, lastAttempt: new Date() },
  });
  return NextResponse.json({ progress: created });
}
