import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const symbols = await db.codeSymbol.findMany({
    orderBy: [{ filePath: "asc" }, { kind: "asc" }],
  });
  const diagnostics = await db.diagnostic.findMany();
  const diagBySymbol = new Map<string, number>();
  for (const d of diagnostics) {
    if (d.symbolName) diagBySymbol.set(d.symbolName, (diagBySymbol.get(d.symbolName) ?? 0) + 1);
  }
  return NextResponse.json({
    symbols: symbols.map((s) => ({ ...s, diagnosticCount: diagBySymbol.get(s.qualifiedName) ?? 0 })),
    repoId: "logistics",
    fileCount: new Set(symbols.map((s) => s.filePath)).size,
  });
}
