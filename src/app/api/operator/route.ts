import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit, getControl, operatorCheck } from "@/lib/gate";

export async function GET(req: Request) {
  const control = await getControl();
  return NextResponse.json({ control, devMode: operatorCheck(req).devMode });
}

// Operator-only: toggle the kill switch or change the approval threshold.
export async function POST(req: Request) {
  const auth = operatorCheck(req);
  if (!auth.ok) return NextResponse.json({ error: "operator token required" }, { status: 401 });
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
