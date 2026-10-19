import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialPopulation,
  evolvePopulation,
  isProfile,
  rankPopulation,
  scoreGenes,
  summarizePopulation,
} from "../src/lib/evolution.ts";

test("profiles are validated and score exact targets at 100", () => {
  assert.equal(isProfile("coding"), true);
  assert.equal(isProfile("unknown"), false);
  assert.equal(scoreGenes({ reasoning: 0.62, coding: 0.96, memory: 0.62, collaboration: 0.56 }, "coding"), 100);
});

test("seeded initial populations are repeatable and bounded", () => {
  const a = createInitialPopulation(16, "balanced", 123);
  const b = createInitialPopulation(16, "balanced", 123);
  assert.deepEqual(a, b);
  assert.equal(a.length, 16);
  assert.ok(a.every((candidate) => Object.values(candidate.genes).every((gene) => gene >= 0 && gene <= 1)));
});

test("evolution preserves the champion, size, stable IDs, and valid genes", () => {
  const first = createInitialPopulation(20, "reasoning", 42);
  const next = evolvePopulation(first, 1, 20, 0.2, "reasoning", 42);
  assert.equal(next.population.length, 20);
  assert.ok(next.population.some((candidate) => candidate.id === "g1-c01"));
  assert.equal(next.population[0].fitness, rankPopulation(first)[0].fitness);
  assert.equal(new Set(next.population.map((candidate) => candidate.id)).size, 20);
  assert.ok(next.population.every((candidate) => Object.values(candidate.genes).every((gene) => gene >= 0 && gene <= 1)));
  assert.ok(next.mutationCount >= 0);
});

test("zero mutation is deterministic and records no mutations", () => {
  const first = createInitialPopulation(12, "memory", 9);
  const a = evolvePopulation(first, 2, 12, 0, "memory", 9);
  const b = evolvePopulation(first, 2, 12, 0, "memory", 9);
  assert.deepEqual(a, b);
  assert.equal(a.mutationCount, 0);
});

test("summary returns finite best and mean proxy fitness", () => {
  const summary = summarizePopulation(createInitialPopulation(10, "collaboration", 7));
  assert.ok(summary.bestFitness >= summary.averageFitness);
  assert.ok(Number.isFinite(summary.averageFitness));
});
