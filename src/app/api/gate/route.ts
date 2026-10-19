import { NextResponse } from "next/server";
import { ACTIONS, classifyRisk, getControl, needsApproval, type GatedAction } from "@/lib/gate";

// Dry run: how would an action be classified right now? Creates nothing.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const action = sp.get("action") as GatedAction;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: `action must be one of ${ACTIONS.join(", ")}` }, { status: 400 });
  const amount = Number(sp.get("amount") ?? 0);
  const control = await getControl();
  const tier = classifyRisk(action, amount, control.approvalThreshold);
  return NextResponse.json({ action, amount, tier, needsApproval: needsApproval(tier), killSwitch: control.killSwitch });
}
