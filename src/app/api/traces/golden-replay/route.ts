// HONEST Golden-Set Replay.
//
// For each pinned GoldenSetItem, we re-execute the exact stored prompt
// against the live model, hash the output, and compare to the expected
// output's hash + semantic similarity. The drift reported is REAL —
// measured from actual model outputs, not a random number.
//
// This is the feature enterprises pay for: drift detection that fires
// before model/prompt changes silently corrupt behavior.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runCompletion, sha256, computeDrift, aiProviderConfigured, NoAIProviderError } from "@/lib/llm";
import { aiErrorResponse } from "@/lib/ai/metered";
import { AIRequestError } from "@/lib/ai/provider";

type ReplayResult = {
  title: string;
  category: string;
  drift: number;
  passed: boolean;
  duration: number;
  error?: string;
  [k: string]: unknown;
};

export async function GET() {
  // List the golden-set registry + recent replays
  const items = await db.goldenSetItem.findMany({
    include: { replays: { take: 5, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST() {
  const items = await db.goldenSetItem.findMany({ orderBy: { createdAt: "asc" } });
  if (items.length === 0) {
    return NextResponse.json({ error: "no golden-set items registered" }, { status: 400 });
  }
  // Fail honestly: without a model there is nothing to replay, so we never
  // fabricate outputs or drift numbers.
  if (!aiProviderConfigured()) {
    return NextResponse.json({ error: new NoAIProviderError().message, code: "NO_AI_PROVIDER" }, { status: 503 });
  }

  const results: ReplayResult[] = [];
  let totalDrift = 0;
  let passCount = 0;
  const DRIFT_THRESHOLD = 0.3; // drift >= 0.3 = fail

  for (const item of items) {
    const startedAt = Date.now();
    try {
      // Re-execute the pinned prompt against the LIVE model
      const { output, latencyMs, model, receipt } = await runCompletion(item.prompt, { purpose: `golden-replay:${item.id}` });
      const actualOutput = output.trim();
      const actualHash = sha256(actualOutput);

      // Measure real drift against the golden output
      const { tokenSim, editSim, drift, hashMatch } = computeDrift(item.expectedOutput, actualOutput);
      const passed = drift < DRIFT_THRESHOLD;

      const replay = await db.goldenSetReplay.create({
        data: {
          itemId: item.id,
          modelUsed: model,
          actualOutput,
          actualHash,
          hashMatch,
          semanticSim: Math.max(tokenSim, editSim),
          drift,
          passed,
          latencyMs,
        },
      });

      results.push({
        title: item.title,
        category: item.category,
        modelPin: item.modelPin,
        expectedHash: item.expectedHash.slice(0, 16) + "…",
        actualHash: actualHash.slice(0, 16) + "…",
        hashMatch,
        tokenSim,
        editSim,
        drift,
        passed,
        latencyMs,
        duration: Date.now() - startedAt,
        expectedExcerpt: item.expectedOutput.slice(0, 100) + "…",
        actualExcerpt: actualOutput.slice(0, 100) + "…",
        replayId: replay.id,
        modelUsed: model,
        receipt,
      });

      totalDrift += drift;
      if (passed) passCount++;
    } catch (e: any) {
      if (e instanceof NoAIProviderError || (e instanceof AIRequestError && e.code === "AI_RATE_LIMITED")) {
        const m = aiErrorResponse(e)!;
        return NextResponse.json(m.body, { status: m.status });
      }
      results.push({
        title: item.title,
        category: item.category,
        error: e.message,
        drift: 1,
        passed: false,
        duration: Date.now() - startedAt,
      });
      totalDrift += 1;
    }
  }

  const count = results.length;
  const avgDrift = totalDrift / count;
  const passRate = passCount / count;

  // Drift triad — categorized by domain (semantic, coordination, behavioral)
  const byCategory = results.reduce((acc, r) => {
    const key = r.category || "other";
    if (!acc[key]) acc[key] = { count: 0, totalDrift: 0 };
    acc[key].count++;
    acc[key].totalDrift += r.drift ?? 1;
    return acc;
  }, {} as Record<string, { count: number; totalDrift: number }>);
  const driftTriad = {
    semantic: (byCategory.reasoning?.totalDrift ?? 0) / (byCategory.reasoning?.count || 1),
    coordination: (byCategory.memory?.totalDrift ?? 0) / (byCategory.memory?.count || 1),
    behavioral: (byCategory.coding?.totalDrift ?? 0) / (byCategory.coding?.count || 1),
    safety: (byCategory.safety?.totalDrift ?? 0) / (byCategory.safety?.count || 1),
  };

  return NextResponse.json({
    summary: {
      count,
      avgDrift,
      passRate,
      driftTriad,
      threshold: DRIFT_THRESHOLD,
      honest: true, // this flag distinguishes real replay from the old random simulation
      measuredAt: new Date().toISOString(),
    },
    results,
  });
}
