// Semantic cache. Stores prompt→response pairs and returns a stored response
// when a new prompt is similar enough (local trigram cosine). Every lookup is
// logged so the hit rate shown anywhere is measured from real lookups.
import { db } from "@/lib/db";
import { cosine, vectorize } from "@/lib/similarity";

export const DEFAULT_THRESHOLD = 0.9;

export async function lookup(prompt: string, scope = "global", threshold = DEFAULT_THRESHOLD) {
  const qv = vectorize(prompt);
  const entries = await db.cacheEntry.findMany({ where: { scope }, orderBy: { createdAt: "desc" }, take: 2000 });
  let best: { id: string; response: string; prompt: string } | null = null; let bestScore = 0;
  for (const e of entries) { const s = cosine(qv, JSON.parse(e.vector)); if (s > bestScore) { bestScore = s; best = e; } }
  const hit = !!best && bestScore >= threshold;
  await db.cacheLookup.create({ data: { scope, hit, score: bestScore } });
  if (hit) await db.cacheEntry.update({ where: { id: best!.id }, data: { hits: { increment: 1 } } });
  return { hit, score: Number(bestScore.toFixed(4)), response: hit ? best!.response : null, matchedPrompt: hit ? best!.prompt : null };
}

export async function store(prompt: string, response: string, scope = "global") {
  return db.cacheEntry.create({ data: { scope, prompt: prompt.slice(0, 8000), response: response.slice(0, 32000), vector: JSON.stringify(vectorize(prompt)) } });
}

export async function stats() {
  const [lookups, hits, entries] = await Promise.all([db.cacheLookup.count(), db.cacheLookup.count({ where: { hit: true } }), db.cacheEntry.count()]);
  return { entries, lookups, hits, measuredHitRate: lookups ? Number((hits / lookups).toFixed(4)) : null };
}
