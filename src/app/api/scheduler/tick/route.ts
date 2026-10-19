import { NextResponse } from "next/server";
import { tick } from "@/lib/scheduler";
import { operatorAllowed } from "@/lib/operator-auth";

// Run all due jobs. Point system cron at this, e.g.
//   * * * * * curl -s -X POST -H "x-operator-token: $TOKEN" http://localhost:3000/api/scheduler/tick
export async function POST(req: Request) {
  if (!operatorAllowed(req)) return NextResponse.json({ error: "operator token required" }, { status: 401 });
  return NextResponse.json(await tick());
}
