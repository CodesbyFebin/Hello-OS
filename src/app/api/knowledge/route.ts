import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDoc, ROLES } from "@/lib/knowledge";
import { operatorAllowed } from "@/lib/operator-auth";

export async function GET() {
  const [docs, roles] = await Promise.all([db.knowledgeDoc.findMany({ select: { id: true, title: true, allowedRoles: true, createdAt: true }, orderBy: { createdAt: "desc" } }), db.agentRole.findMany()]);
  return NextResponse.json({ docs, assignments: roles, roles: ROLES });
}

export async function POST(req: Request) {
  if (!operatorAllowed(req)) return NextResponse.json({ error: "operator token required" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try { const d = await addDoc(String(b.title ?? ""), String(b.body ?? ""), Array.isArray(b.allowedRoles) ? b.allowedRoles.map(String) : []); return NextResponse.json({ id: d.id }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 }); }
}