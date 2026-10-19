// Hello — LLM execution + drift measurement utilities.
// Used by the honest Golden-Set Replay: re-execute pinned prompts against
// the live model and measure real drift (not a random number).
import ZAI from "z-ai-web-dev-sdk";
import { createHash } from "crypto";

let _zai: any = null;
async function getZai() {
  if (!_zai) _zai = await ZAI.create();
  return _zai;
}

export async function runCompletion(prompt: string): Promise<{ output: string; latencyMs: number }> {
  const zai = await getZai();
  const t0 = Date.now();
  const response = await zai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    stream: false,
    thinking: { type: "disabled" },
  });
  const output = response.choices?.[0]?.message?.content ?? "";
  return { output, latencyMs: Date.now() - t0 };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Token-overlap similarity (Jaccard) between two outputs.
 * 1.0 = identical token sets, 0.0 = no overlap.
 * This is a deliberately simple, transparent metric — not a hidden embedding.
 * Real drift = 1 - similarity.
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

/**
 * Character-level normalized edit similarity (0-1).
 * Complementary to token Jaccard — catches paraphrases that share no tokens.
 */
export function editSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length, lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;
  // Levenshtein (bounded for performance)
  const maxLen = Math.max(lenA, lenB);
  const dp: number[][] = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[lenA][lenB];
  return 1 - dist / maxLen;
}

/** Composite drift: max of token-drift and edit-drift, so either signal fires. */
export function computeDrift(expected: string, actual: string): {
  tokenSim: number; editSim: number; drift: number; hashMatch: boolean;
} {
  const tokenSim = tokenSimilarity(expected, actual);
  const editSim = editSimilarity(expected, actual);
  const drift = 1 - Math.max(tokenSim, editSim);
  const hashMatch = sha256(expected.trim()) === sha256(actual.trim());
  return { tokenSim, editSim, drift, hashMatch };
}
