import { NextResponse } from "next/server";
import { tick } from "@/lib/scheduler";
import { operatorAuth, operatorDenied } from "@/lib/operator-auth";

// Run all due jobs. Point system cron at this, e.g.
//   * * * * * curl -s -X POST -H "x-operator-token: $TOKEN" http://localhost:3000/api/scheduler/tick
export async function POST(req: Request) {
  const op = operatorAuth(req); if (!op.ok) return operatorDenied(op);
  return NextResponse.json(await tick());
}
