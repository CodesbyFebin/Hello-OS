import { NextResponse } from "next/server";
import { createAgentCard } from "@/lib/a2a-card";

export function GET() {
  return NextResponse.json(createAgentCard(), { headers: { "Cache-Control": "public, max-age=300" } });
}
