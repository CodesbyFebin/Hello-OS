import { NextResponse } from "next/server";
import { similar } from "@/lib/failures";

// Before retrying, an agent asks: have we hit something like this before?
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ error: "q required" }, { status: 400 });
  return NextResponse.json({ matches: await similar(q.slice(0, 2000)) });
}
