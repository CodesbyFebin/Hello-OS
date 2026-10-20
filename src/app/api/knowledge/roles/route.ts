import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/knowledge";
import { operatorAuth, operatorDenied } from "@/lib/operator-auth";

// Operator-only: grant or revoke a role for an agent.
export async function POST(req: Request) {
  const op = operatorAuth(req); if (!op.ok) return operatorDenied(op);
  const b = await req.json().catch(() => ({}));
  if (!b.agentId || !(ROLES as readonly string[]).includes(b.role)) return NextResponse.json({ error: `agentId and role (${ROLES.join(", ")}) required` }, { status: 400 });
  if (b.revoke) await db.agentRole.deleteMany({ where: { agentId: String(b.agentId), role: b.role } });
  else await db.agentRole.upsert({ where: { agentId_role: { agentId: String(b.agentId), role: b.role } }, update: {}, create: { agentId: String(b.agentId), role: b.role } });
  return NextResponse.json({ ok: true });
}