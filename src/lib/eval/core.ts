// Evidence-backed evaluation: versioned suites, explicit graders, per-task
// results, and a promotion gate. Pure logic (no database, no network) so it is
// deterministic and testable offline. Task success and safety are the gates;
// latency and tokens are reported separately and never folded into a score.
import { createHash } from "node:crypto";

export type Grader =
  | { kind: "exact"; value: string }
  | { kind: "contains"; values: string[] }
  | { kind: "regex"; pattern: string; flags?: string }
  | { kind: "json-keys"; keys: string[] };

export type EvalCase = {
  id: string;
  input: string;
  grader: Grader;
  /** Required cases must pass and must not regress for a candidate to be promotable. */
  required: boolean;
  /** Policy checks: output matching any of these is a safety violation. */
  forbidden?: { pattern: string; flags?: string; reason: string }[];
};

export type EvalSuite = { id: string; version: string; system: string; cases: EvalCase[] };

/** What is under test. Every field goes into the fingerprint. Never put secrets here. */
export type Candidate = {
  id: string;
  revision: string; // git commit / build id the candidate was tested at
  promptVersion: string;
  provider: string;
  model: string;
  config: Record<string, string | number | boolean>;
};

export type ModelReply = { output: string; model?: string; usage?: { promptTokens: number; completionTokens: number } };
export type ModelFn = (messages: { role: "system" | "user"; content: string }[], meta: { caseId: string }) => Promise<ModelReply>;

export type CaseResult = {
  caseId: string;
  required: boolean;
  passed: boolean;
  safetyViolations: string[];
  error: string | null;
  outputHash: string | null;
  latencyMs: number;
  tokens: { prompt: number; completion: number } | null; // null = provider did not report usage
};

export type EvalRunRecord = {
  suiteId: string;
  suiteVersion: string;
  suiteHash: string;
  candidate: Candidate;
  fingerprint: string;
  startedAt: string;
  finishedAt: string;
  results: CaseResult[];
  summary: EvalSummary;
};

export type EvalSummary = {
  total: number;
  passed: number;
  requiredTotal: number;
  requiredPassed: number;
  safetyViolations: number;
  errors: number;
  latencyMsTotal: number;
  tokens: { prompt: number; completion: number } | null;
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as any)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

export const suiteHash = (s: EvalSuite) => sha(stable(s));

/** Ties a result to the exact suite content + candidate revision/config. */
export function fingerprint(suite: EvalSuite, c: Candidate): string {
  return sha(stable({ suite: suiteHash(suite), candidate: c }));
}

export function grade(g: Grader, output: string): boolean {
  switch (g.kind) {
    case "exact": return output.trim() === g.value;
    case "contains": return g.values.every((v) => output.toLowerCase().includes(v.toLowerCase()));
    case "regex": return new RegExp(g.pattern, g.flags).test(output);
    case "json-keys": {
      const m = output.match(/\{[\s\S]*\}/);
      if (!m) return false;
      try { const o = JSON.parse(m[0]); return o && typeof o === "object" && g.keys.every((k) => Object.hasOwn(o, k)); } catch { return false; }
    }
  }
}

export function safety(c: EvalCase, output: string): string[] {
  return (c.forbidden ?? []).filter((f) => new RegExp(f.pattern, f.flags).test(output)).map((f) => f.reason);
}

export function validateSuite(s: EvalSuite): void {
  if (!s.id || !/^\d+\.\d+\.\d+$/.test(s.version)) throw new Error("suite needs an id and semver version");
  const ids = new Set<string>();
  for (const c of s.cases) {
    if (ids.has(c.id)) throw new Error(`duplicate case id ${c.id}`);
    ids.add(c.id);
  }
  if (!s.cases.some((c) => c.required)) throw new Error("suite needs at least one required case");
}

export async function runSuite(suite: EvalSuite, candidate: Candidate, model: ModelFn, now: () => number = Date.now): Promise<EvalRunRecord> {
  validateSuite(suite);
  const startedAt = new Date(now()).toISOString();
  const results: CaseResult[] = [];
  for (const c of suite.cases) {
    const t0 = now();
    try {
      const r = await model([{ role: "system", content: suite.system }, { role: "user", content: c.input }], { caseId: c.id });
      const output = typeof r.output === "string" ? r.output : "";
      const violations = safety(c, output);
      results.push({
        caseId: c.id, required: c.required,
        passed: violations.length === 0 && grade(c.grader, output),
        safetyViolations: violations, error: null, outputHash: sha(output),
        latencyMs: Math.max(0, now() - t0),
        tokens: r.usage ? { prompt: r.usage.promptTokens, completion: r.usage.completionTokens } : null,
      });
    } catch (e: any) {
      results.push({ caseId: c.id, required: c.required, passed: false, safetyViolations: [], error: String(e?.code ?? e?.message ?? e).slice(0, 200), outputHash: null, latencyMs: Math.max(0, now() - t0), tokens: null });
    }
  }
  return { suiteId: suite.id, suiteVersion: suite.version, suiteHash: suiteHash(suite), candidate, fingerprint: fingerprint(suite, candidate), startedAt, finishedAt: new Date(now()).toISOString(), results, summary: summarize(results) };
}

export function summarize(results: CaseResult[]): EvalSummary {
  const withTokens = results.filter((r) => r.tokens);
  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    requiredTotal: results.filter((r) => r.required).length,
    requiredPassed: results.filter((r) => r.required && r.passed).length,
    safetyViolations: results.reduce((n, r) => n + r.safetyViolations.length, 0),
    errors: results.filter((r) => r.error).length,
    latencyMsTotal: results.reduce((n, r) => n + r.latencyMs, 0),
    tokens: withTokens.length ? withTokens.reduce((a, r) => ({ prompt: a.prompt + r.tokens!.prompt, completion: a.completion + r.tokens!.completion }), { prompt: 0, completion: 0 }) : null,
  };
}

export type Comparison = {
  eligible: boolean;
  reasons: string[];
  regressions: string[];
  improvements: string[];
};

/**
 * Candidate vs baseline on the same suite content. Eligible only if: same suite
 * hash, every required case passes, no safety violations, no errors on required
 * cases, and no case that passed in the baseline fails now. Eligibility is not
 * promotion: a human must still approve.
 */
export function compare(baseline: EvalRunRecord | null, cand: EvalRunRecord): Comparison {
  const reasons: string[] = [];
  const regressions: string[] = [];
  const improvements: string[] = [];
  if (baseline && baseline.suiteHash !== cand.suiteHash) reasons.push("baseline and candidate ran different suite content");
  if (cand.summary.requiredPassed < cand.summary.requiredTotal) reasons.push(`required cases failing: ${cand.results.filter((r) => r.required && !r.passed).map((r) => r.caseId).join(", ")}`);
  if (cand.summary.safetyViolations > 0) reasons.push(`safety violations: ${cand.summary.safetyViolations}`);
  if (baseline && baseline.suiteHash === cand.suiteHash) {
    const before = new Map(baseline.results.map((r) => [r.caseId, r.passed]));
    for (const r of cand.results) {
      if (before.get(r.caseId) === true && !r.passed) regressions.push(r.caseId);
      if (before.get(r.caseId) === false && r.passed) improvements.push(r.caseId);
    }
    if (regressions.length) reasons.push(`regressed vs baseline: ${regressions.join(", ")}`);
    if (cand.summary.passed < baseline.summary.passed) reasons.push("fewer cases pass than baseline");
  }
  return { eligible: reasons.length === 0, reasons, regressions, improvements };
}

/** Offline, deterministic model: returns a fixed reply per case id. No network. */
export function fixtureModel(replies: Record<string, string | ModelReply | Error>): ModelFn {
  return async (_messages, { caseId }) => {
    const r = replies[caseId];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error(`fixture has no reply for case ${caseId}`);
    return typeof r === "string" ? { output: r } : r;
  };
}
