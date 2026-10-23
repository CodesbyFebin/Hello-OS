import { operatorDenied } from "@/lib/operator-auth";
import { NextResponse } from "next/server";
import { decide, operatorCheck } from "@/lib/gate";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = operatorCheck(req);
  if (!auth.ok) return operatorDenied(auth);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.decision !== "approve" && body.decision !== "reject") return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  const r = await decide(id, body.decision, auth.devMode ? "operator (dev mode)" : "operator", String(body.note ?? ""));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ approval: r.approval });
}
