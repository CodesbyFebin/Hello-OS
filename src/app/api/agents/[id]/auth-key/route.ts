import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newAuthKeypair } from "@/lib/agent-auth";
import { principalLabel, requireOperator } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Operator: issue or rotate an agent's request-auth key. The private key is returned once and never stored. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = requireOperator(req);
  if (!op.ok) return op.response;
  const { id } = await params;
  if (!(await db.agent.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const k = await newAuthKeypair();
  await db.agent.update({ where: { id }, data: { authPublicKeyHex: k.publicKeyHex, authKeyIssuedAt: new Date(), authKeyRevokedAt: null } });
  await db.auditLog.create({ data: { actor: principalLabel(op.principal), action: "agent.authkey.issue", target: id, detail: JSON.stringify({ publicKeyHex: k.publicKeyHex }) } });
  return NextResponse.json({ agentId: id, publicKeyHex: k.publicKeyHex, agentAuthKey: { authSecretHex: k.secretHex, note: "Shown once and not stored. Any previous key no longer works." } });
}

/** Operator: revoke the agent's request-auth key. Signed requests fail until a new key is issued. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = requireOperator(req);
  if (!op.ok) return op.response;
  const { id } = await params;
  if (!(await db.agent.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  await db.agent.update({ where: { id }, data: { authPublicKeyHex: null, authKeyRevokedAt: new Date() } });
  await db.auditLog.create({ data: { actor: principalLabel(op.principal), action: "agent.authkey.revoke", target: id, detail: "{}" } });
  return NextResponse.json({ agentId: id, revoked: true });
}
