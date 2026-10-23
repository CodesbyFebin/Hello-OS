// Optional, format-only adapter for Google Stax (github.com/google-labs-code/stax,
// Apache-2.0). No dependency, no network, no Google account: it only reads and
// writes the CSV shapes Stax uses for dataset upload and chat export.
//
// - exportSuiteCsv: a HELLO suite (and optionally the outputs of one run) as a
//   Stax dataset CSV. On upload, choose input = "input", output = "output",
//   expected output = "expected_output".
// - importStaxCsv: reads a Stax chat export CSV (system_instruction, input,
//   output, human_evaluation, human_evaluation_notes, llm_evaluations, ...) and
//   returns advisory annotations keyed by HELLO case id.
//
// HELLO's own run records stay the source of truth. Nothing here changes a run,
// a summary, or the promotion gate; annotations are informational only.
import { suiteHash, type EvalRunRecord, type EvalSuite, type Grader } from "./core";

export const STAX_DATASET_COLUMNS = ["system_instruction", "input", "expected_output", "output", "hello_case_id", "hello_required", "hello_grader", "hello_passed"] as const;

function cell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** RFC 4180 parser: quoted fields, doubled quotes, newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += c;
  }
  if (q) throw new Error("CSV: unterminated quoted field");
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** A readable expected output for Stax raters. The grader itself is exported verbatim in hello_grader. */
export function expectedFromGrader(g: Grader): string {
  switch (g.kind) {
    case "exact": return g.value;
    case "contains": return `Must contain: ${g.values.join(", ")}`;
    case "regex": return `Must match /${g.pattern}/${g.flags ?? ""}`;
    case "json-keys": return `JSON with keys: ${g.keys.join(", ")}`;
  }
}

export function exportSuiteCsv(suite: EvalSuite, opts: { run?: EvalRunRecord; outputs?: Record<string, string> } = {}): string {
  if (opts.run && opts.run.suiteHash !== suiteHash(suite)) throw new Error("run record is for a different suite version (suiteHash mismatch)");
  const byCase = new Map(opts.run?.results.map((r) => [r.caseId, r]) ?? []);
  const rows: string[][] = [[...STAX_DATASET_COLUMNS]];
  for (const c of suite.cases) {
    const r = byCase.get(c.id);
    rows.push([suite.system, c.input, expectedFromGrader(c.grader), opts.outputs?.[c.id] ?? "", c.id, String(c.required), JSON.stringify(c.grader), r ? String(r.passed && r.safetyViolations.length === 0) : ""]);
  }
  return toCsv(rows);
}

export type StaxAnnotation = {
  caseId: string;
  /** Stax human rating as exported (sample data uses 1 / -1); null if absent or not a number. */
  humanEvaluation: number | null;
  humanNotes: string;
  /** Stax LLM evaluator results as exported, e.g. { TextQuality: { score: "1.0", ... } }. Not verified by HELLO. */
  llmEvaluations: Record<string, { score: number | null; raw: unknown }>;
  model: string;
};
export type StaxImport = { annotations: StaxAnnotation[]; unmatched: { row: number; input: string }[]; advisory: true; note: string };

export function importStaxCsv(csv: string, suite: EvalSuite): StaxImport {
  const [head, ...rows] = parseCsv(csv);
  if (!head) throw new Error("CSV is empty");
  const col = (n: string) => head.findIndex((h) => h.trim() === n);
  const iInput = col("input");
  if (iInput < 0) throw new Error('CSV has no "input" column; expected a Stax chat export');
  const iId = col("hello_case_id"), iHuman = col("human_evaluation"), iNotes = col("human_evaluation_notes"), iLlm = col("llm_evaluations"), iModel = col("model_nickname");
  const byInput = new Map(suite.cases.map((c) => [c.input.trim(), c.id]));
  const ids = new Set(suite.cases.map((c) => c.id));
  const annotations: StaxAnnotation[] = [];
  const unmatched: StaxImport["unmatched"] = [];
  rows.forEach((r, n) => {
    const input = (r[iInput] ?? "").trim();
    const caseId = iId >= 0 && ids.has(r[iId]) ? r[iId] : byInput.get(input);
    if (!caseId) { unmatched.push({ row: n + 2, input: input.slice(0, 120) }); return; }
    const h = iHuman >= 0 && r[iHuman]?.trim() !== "" ? Number(r[iHuman]) : NaN;
    const llm: StaxAnnotation["llmEvaluations"] = {};
    if (iLlm >= 0 && r[iLlm]?.trim()) {
      try {
        const o = JSON.parse(r[iLlm]);
        if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) {
          const sc = Number((v as { score?: unknown })?.score);
          llm[k] = { score: Number.isFinite(sc) ? sc : null, raw: v };
        }
      } catch { llm._unparsed = { score: null, raw: r[iLlm].slice(0, 2000) }; }
    }
    annotations.push({ caseId, humanEvaluation: Number.isFinite(h) ? h : null, humanNotes: iNotes >= 0 ? r[iNotes] ?? "" : "", llmEvaluations: llm, model: iModel >= 0 ? r[iModel] ?? "" : "" });
  });
  return { annotations, unmatched, advisory: true, note: "Stax ratings are advisory. HELLO run records and the promotion gate are unchanged." };
}
