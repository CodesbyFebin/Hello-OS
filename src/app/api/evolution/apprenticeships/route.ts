import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { meteredChat, aiErrorResponse } from "@/lib/ai/metered";
import { aiProviderConfigured, NoAIProviderError } from "@/lib/ai/provider";
import { guardWrite } from "@/lib/guard";

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
  const g = await guardWrite(req, { bucket: "operator", operatorOnly: true });
  if (!g.ok) return g.response;
  const body = g.json;
  const { mentorId, apprenticeId } = body;
  if (!mentorId || !apprenticeId) return NextResponse.json({ error: "mentor+apprentice required" }, { status: 400 });
  const app = await db.apprenticeship.create({
    data: { mentorId, apprenticeId, status: "shadowing" },
  });
  return NextResponse.json({ apprenticeship: app });
}

// Graduate an apprenticeship — extract procedure
export async function PATCH(req: Request) {
  const g = await guardWrite(req, { bucket: "operator", operatorOnly: true });
  if (!g.ok) return g.response;
  const body = g.json;
  const { id, action } = body; // action: extract | graduate
  if (action === "extract") {
    const app = await db.apprenticeship.findUnique({ where: { id } });
    if (!app) return NextResponse.json({ error: "apprenticeship not found" }, { status: 404 });
    // The procedure is derived from the mentor's real recorded traces: the id is
    // the sha256 of the ordered trace list. No traces means nothing to extract.
    const traces = await db.trace.findMany({
      where: { agentId: app.mentorId, status: "completed" },
      orderBy: { startedAt: "asc" },
      take: 50,
      select: { traceId: true, title: true, toolCalls: true },
    });
    if (traces.length === 0) {
      return NextResponse.json({ error: "mentor has no completed traces to extract a procedure from" }, { status: 409 });
    }
    if (!aiProviderConfigured()) {
      const e = new NoAIProviderError();
      return NextResponse.json({ error: e.message, code: e.code }, { status: 503 });
    }
    const digest = createHash("sha256").update(JSON.stringify(traces)).digest("hex");
    // The model summarises the mentor's real traces into numbered steps; the
    // apprentice's wallet pays the per-call credits (H).
    let ai;
    try {
      ai = await meteredChat([
        { role: "system", content: "You extract a reusable procedure from an agent's recorded traces. Reply with a short numbered list of steps only. Do not invent tools that are not in the traces." },
        { role: "user", content: JSON.stringify(traces).slice(0, 12000) },
      ], { purpose: `apprenticeship-extract:${id}`, agentId: app.apprenticeId, maxTokens: 600 });
    } catch (e) {
      const m = aiErrorResponse(e);
      if (m) return NextResponse.json(m.body, { status: m.status });
      throw e;
    }
    const updated = await db.apprenticeship.update({
      where: { id },
      data: { status: "extracting", procedure: `proc:${digest.slice(0, 16)} (from ${traces.length} traces, model ${ai.model}, receipt ${ai.receipt.slice(0, 16)})\n${ai.output.trim().slice(0, 4000)}` },
    });
    return NextResponse.json({ apprenticeship: updated, ai: { model: ai.model, receipt: ai.receipt, credits: ai.credits, unit: "H" } });
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
