import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evolvePopulation, summarizePopulation, type Candidate, type Profile } from "@/lib/evolution";
import { guardWrite } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardWrite(req, { bucket: "operator", operatorOnly: true });
  if (!g.ok) return g.response;
  const { id } = await params;
  try {
    const result = await db.$transaction(async (tx) => {
      const run = await tx.evolutionRun.findUnique({ where: { id } });
      if (!run) return { error: "Evolution run not found.", status: 404 };
      if (run.status !== "active") return { error: `Run is ${run.status}; resume it before stepping.`, status: 409 };
      if (run.currentGeneration >= run.generationLimit) return { error: "Run has reached its generation limit.", status: 409 };

      const previous = await tx.evolutionGeneration.findUnique({
        where: { runId_generation: { runId: id, generation: run.currentGeneration } },
      });
      if (!previous) return { error: "Current generation record is missing.", status: 500 };

      const nextGeneration = run.currentGeneration + 1;
      const evolved = evolvePopulation(
        JSON.parse(previous.populationJson) as Candidate[],
        nextGeneration,
        run.populationSize,
        run.mutationRate,
        run.profile as Profile,
        run.seed,
      );
      const summary = summarizePopulation(evolved.population);
      const nextStatus = nextGeneration >= run.generationLimit ? "completed" : "active";
      const claimed = await tx.evolutionRun.updateMany({
        where: { id, status: "active", currentGeneration: run.currentGeneration },
        data: {
          currentGeneration: nextGeneration,
          bestFitness: Math.max(run.bestFitness, summary.bestFitness),
          status: nextStatus,
          completedAt: nextStatus === "completed" ? new Date() : null,
        },
      });
      if (claimed.count !== 1) return { error: "Run changed while this generation was being calculated. Refresh and try again.", status: 409 };

      const generation = await tx.evolutionGeneration.create({
        data: {
          runId: id,
          generation: nextGeneration,
          bestFitness: summary.bestFitness,
          averageFitness: summary.averageFitness,
          mutationCount: evolved.mutationCount,
          populationJson: JSON.stringify(evolved.population),
          championJson: JSON.stringify(summary.champion),
        },
      });
      return { run: { ...run, currentGeneration: nextGeneration, bestFitness: Math.max(run.bestFitness, summary.bestFitness), status: nextStatus }, generation };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error("evolution step failed", error);
    return NextResponse.json({ error: "Could not persist the next generation." }, { status: 500 });
  }
}
