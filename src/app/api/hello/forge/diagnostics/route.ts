import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const diagnostics = await db.diagnostic.findMany({
    orderBy: [{ filePath: "asc" }, { line: "asc" }],
  });
  return NextResponse.json({ diagnostics, errorCount: diagnostics.filter((d) => d.category === "error").length });
}
