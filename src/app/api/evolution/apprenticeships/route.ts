import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const apps = await db.apprenticeship.findMany({
    include: {
      mentor: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true } },
      apprentice: { select: { id: true, name: true, did: true, avatar: true, guardianTier: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ apprenticeships: apps });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { mentorId, apprenticeId } = body;
  if (!mentorId || !apprenticeId) return NextResponse.json({ error: "mentor+apprentice required" }, { status: 400 });
  const app = await db.apprenticeship.create({
    data: { mentorId, apprenticeId, status: "shadowing" },
  });
  return NextResponse.json({ apprenticeship: app });
}

// Graduate an apprenticeship — extract procedure
export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, action } = body; // action: extract | graduate
  if (action === "extract") {
    const updated = await db.apprenticeship.update({
      where: { id },
      data: { status: "extracting", procedure: `proc:extracted-${Math.random().toString(36).slice(2, 8)}` },
    });
    return NextResponse.json({ apprenticeship: updated });
  }
  if (action === "graduate") {
    const updated = await db.apprenticeship.update({
      where: { id },
      data: { status: "graduated", graduatedAt: new Date() },
    });
    return NextResponse.json({ apprenticeship: updated });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
