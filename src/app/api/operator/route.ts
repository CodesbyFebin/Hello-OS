import { operatorDenied } from "@/lib/operator-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, getControl, operatorCheck } from "@/lib/gate";

export async function GET(req: Request) {
  const control = await getControl();
  const a = operatorCheck(req);
  // Lets the dashboard show a truthful state: dev mode, authorized, token missing/wrong (401) or not configured (503).
  return NextResponse.json({ control, devMode: a.devMode, auth: a.ok ? { authorized: true, devMode: a.devMode } : { authorized: false, status: a.status, code: a.code, message: a.error } });
}

// Operator-only: toggle the kill switch or change the approval threshold.
export async function POST(req: Request) {
  const auth = operatorCheck(req);
  if (!auth.ok) return operatorDenied(auth);
  const body = await req.json().catch(() => ({}));
  const data: { killSwitch?: boolean; approvalThreshold?: number } = {};
  if (typeof body.killSwitch === "boolean") data.killSwitch = body.killSwitch;
  if (body.approvalThreshold !== undefined) {
    const t = Number(body.approvalThreshold);
    if (!Number.isFinite(t) || t < 0 || t > 1e6) return NextResponse.json({ error: "approvalThreshold must be 0..1e6" }, { status: 400 });
    data.approvalThreshold = t;
  }
  await getControl();
  const control = await db.operatorControl.update({ where: { id: "singleton" }, data });
  await audit("operator", "operator.update", "control", JSON.stringify(data));
  return NextResponse.json({ control, devMode: auth.devMode });
}
