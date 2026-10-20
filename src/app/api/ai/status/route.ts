import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/provider";
import { creditsPerCall } from "@/lib/ai/metered";

export const dynamic = "force-dynamic";

// Reports AI provider config without secrets (the API key is never returned).
export async function GET() {
  return NextResponse.json({ ...aiStatus(), creditsPerCall: creditsPerCall(), unit: "H" });
}
