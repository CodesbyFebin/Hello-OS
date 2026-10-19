import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createInitialPopulation, isProfile, summarizePopulation } from "@/lib/evolution";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await db.evolutionRun.findMany({
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { generations: { orderBy: { generation: "desc" }, take: 1, select: { generation: true, bestFitness: true, averageFitness: true } } },
  });
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const profile = body.profile;
  const populationSize = body.populationSize ?? 24;
  const mutationRate = body.mutationRate ?? 0.12;
  const generationLimit = body.generationLimit ?? 20;
  const seed = body.seed ?? randomInt(0, 2_147_483_647);

  if (!name) return NextResponse.json({ error: "A run name is required." }, { status: 400 });
  if (!isProfile(profile)) return NextResponse.json({ error: "Choose a supported optimization profile." }, { status: 400 });
  if (!Number.isInteger(populationSize) || (populationSize as number) < 8 || (populationSize as number) > 64) {
    return NextResponse.json({ error: "Population size must be an integer from 8 to 64." }, { status: 400 });
  }
  if (typeof mutationRate !== "number" || !Number.isFinite(mutationRate) || mutationRate < 0 || mutationRate > 0.4) {
    return NextResponse.json({ error: "Mutation rate must be between 0 and 0.4." }, { status: 400 });
  }
  if (!Number.isInteger(generationLimit) || (generationLimit as number) < 1 || (generationLimit as number) > 100) {
    return NextResponse.json({ error: "Generation limit must be an integer from 1 to 100." }, { status: 400 });
  }
  if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 2_147_483_647) {
    return NextResponse.json({ error: "Seed must be a non-negative 32-bit integer." }, { status: 400 });
  }

  const firstPopulation = createInitialPopulation(populationSize as number, profile, seed as number);
  const summary = summarizePopulation(firstPopulation);
  const run = await db.$transaction(async (tx) => {
    const created = await tx.evolutionRun.create({
      data: {
        name,
        profile,
        populationSize: populationSize as number,
        mutationRate,
        generationLimit: generationLimit as number,
        currentGeneration: 0,
        bestFitness: summary.bestFitness,
        seed: seed as number,
        status: generationLimit === 1 ? "completed" : "active",
        completedAt: generationLimit === 1 ? new Date() : null,
      },
    });
    await tx.evolutionGeneration.create({
      data: {
        runId: created.id,
        generation: 0,
        bestFitness: summary.bestFitness,
        averageFitness: summary.averageFitness,
        mutationCount: 0,
        populationJson: JSON.stringify(firstPopulation),
        championJson: JSON.stringify(summary.champion),
      },
    });
    return created;
  });

  return NextResponse.json({ run }, { status: 201 });
}
