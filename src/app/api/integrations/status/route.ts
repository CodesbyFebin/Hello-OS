import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runStatusChecks } from "@/lib/integrations/status";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runStatusChecks({
    env: process.env,
    fetchImpl: fetch,
    countTables: async () => {
      const rows = await db.$queryRawUnsafe<{ n: number | bigint }[]>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
      return Number(rows[0]?.n ?? 0);
    },
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
