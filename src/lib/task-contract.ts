import { createHash } from "node:crypto";

/** Static task-contract validation only; valid contracts are never executed. */
export const TASK_CONTRACT_SCHEMA = "hello.task/v1" as const;
export const MAX_TASK_CONTRACT_BYTES = 32 * 1024;

export type TaskContract = {
  schema: typeof TASK_CONTRACT_SCHEMA;
  goal: string;
  scope: { include: string[]; exclude: string[] };
  capabilities: string[];
  constraints: string[];
  success: { kind: "measurable" | "human_review"; criteria: string[] };
  failureCriteria: string[];
  budgets: {
    tokens: { perStep: number; total: number };
    toolCalls: { perStep: number; total: number };
    wallClockSeconds: { perStep: number; total: number };
  };
  approval: "required" | "not_required";
  termination: { onSuccess: "report"; onFailure: "report" | "escalate"; onTimeout: "fail" | "pause" };
};

export type TaskContractDiagnostic = { code: string; path: string; message: string };
export type TaskContractValidation = {
  valid: boolean;
  executable: false;
  schema: typeof TASK_CONTRACT_SCHEMA;
  contract?: TaskContract;
  contractHash?: string;
  diagnostics: TaskContractDiagnostic[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (isRecord(value)) {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function validateTaskContract(input: unknown): TaskContractValidation {
  const diagnostics: TaskContractDiagnostic[] = [];
  const add = (code: string, path: string, message: string) => diagnostics.push({ code, path, message });
  const object = (value: unknown, path: string, allowed: string[]): Record<string, unknown> => {
    if (!isRecord(value)) { add("CONTRACT_OBJECT", path, "must be a JSON object"); return {}; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) add("CONTRACT_UNKNOWN_FIELD", path + "." + key, "unknown field");
    return value;
  };
  const string = (value: unknown, path: string, max: number, min = 1): string => {
    if (typeof value !== "string" || value.trim().length < min || value.length > max) {
      add("CONTRACT_STRING", path, "must be a string from " + min + " to " + max + " characters");
      return "";
    }
    return value.trim();
  };
  const list = (value: unknown, path: string, maxItems: number, maxLength: number, required = true): string[] => {
    if (value === undefined && !required) return [];
    if (!Array.isArray(value) || value.length > maxItems || (required && value.length === 0)) {
      add("CONTRACT_LIST", path, "must be " + (required ? "a non-empty" : "an") + " array with at most " + maxItems + " items");
      return [];
    }
    const result = value.map((item, index) => string(item, path + "[" + index + "]", maxLength));
    const seen = new Set<string>();
    result.forEach((item, index) => {
      const key = item.toLocaleLowerCase("en-US");
      if (seen.has(key)) add("CONTRACT_DUPLICATE", path + "[" + index + "]", "duplicate item");
      seen.add(key);
    });
    return result;
  };
  const limit = (value: unknown, path: string, max: number): number => {
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > max) {
      add("CONTRACT_LIMIT", path, "must be an integer from 1 to " + max);
      return 0;
    }
    return Number(value);
  };

  const root = object(input, "$", ["schema", "goal", "scope", "capabilities", "constraints", "success", "failureCriteria", "budgets", "approval", "termination"]);
  if (root.schema !== TASK_CONTRACT_SCHEMA) add("CONTRACT_SCHEMA", "$.schema", "must equal '" + TASK_CONTRACT_SCHEMA + "'");
  const scopeRaw = object(root.scope, "$.scope", ["include", "exclude"]);
  const include = list(scopeRaw.include, "$.scope.include", 32, 300);
  const exclude = list(scopeRaw.exclude, "$.scope.exclude", 32, 300, false);
  const includeSet = new Set(include.map((item) => item.toLocaleLowerCase("en-US")));
  exclude.forEach((item, index) => {
    if (includeSet.has(item.toLocaleLowerCase("en-US"))) add("CONTRACT_SCOPE_CONFLICT", "$.scope.exclude[" + index + "]", "scope item cannot be both included and excluded");
  });

  const capabilities = list(root.capabilities, "$.capabilities", 32, 64, false);
  capabilities.forEach((capability, index) => {
    if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(capability)) {
      add("CONTRACT_CAPABILITY_NAME", "$.capabilities[" + index + "]", "must be a lowercase capability identifier, for example 'memory.read'");
    }
  });

  const successRaw = object(root.success, "$.success", ["kind", "criteria"]);
  const successKind = successRaw.kind;
  if (successKind !== "measurable" && successKind !== "human_review") add("CONTRACT_SUCCESS_KIND", "$.success.kind", "must be 'measurable' or 'human_review'");

  const budgetsRaw = object(root.budgets, "$.budgets", ["tokens", "toolCalls", "wallClockSeconds"]);
  const budget = (key: "tokens" | "toolCalls" | "wallClockSeconds", max: number) => {
    const raw = object(budgetsRaw[key], "$.budgets." + key, ["perStep", "total"]);
    const perStep = limit(raw.perStep, "$.budgets." + key + ".perStep", max);
    const total = limit(raw.total, "$.budgets." + key + ".total", max);
    if (perStep && total && total < perStep) add("CONTRACT_BUDGET_ORDER", "$.budgets." + key + ".total", "total budget must be greater than or equal to the per-step budget");
    return { perStep, total };
  };

  const terminationRaw = object(root.termination, "$.termination", ["onSuccess", "onFailure", "onTimeout"]);
  if (terminationRaw.onSuccess !== "report") add("CONTRACT_TERMINATION", "$.termination.onSuccess", "must be 'report'");
  if (terminationRaw.onFailure !== "report" && terminationRaw.onFailure !== "escalate") add("CONTRACT_TERMINATION", "$.termination.onFailure", "must be 'report' or 'escalate'");
  if (terminationRaw.onTimeout !== "fail" && terminationRaw.onTimeout !== "pause") add("CONTRACT_TERMINATION", "$.termination.onTimeout", "must be 'fail' or 'pause'");
  if (root.approval !== "required" && root.approval !== "not_required") add("CONTRACT_APPROVAL", "$.approval", "must be 'required' or 'not_required'");

  const contract: TaskContract = {
    schema: TASK_CONTRACT_SCHEMA,
    goal: string(root.goal, "$.goal", 500),
    scope: { include, exclude },
    capabilities,
    constraints: list(root.constraints, "$.constraints", 64, 500, false),
    success: {
      kind: successKind === "human_review" ? "human_review" : "measurable",
      criteria: list(successRaw.criteria, "$.success.criteria", 32, 500),
    },
    failureCriteria: list(root.failureCriteria, "$.failureCriteria", 32, 500, false),
    budgets: {
      tokens: budget("tokens", 10_000_000),
      toolCalls: budget("toolCalls", 10_000),
      wallClockSeconds: budget("wallClockSeconds", 86_400),
    },
    approval: root.approval === "required" ? "required" : "not_required",
    termination: {
      onSuccess: "report",
      onFailure: terminationRaw.onFailure === "escalate" ? "escalate" : "report",
      onTimeout: terminationRaw.onTimeout === "pause" ? "pause" : "fail",
    },
  };

  if (diagnostics.length) return { valid: false, executable: false, schema: TASK_CONTRACT_SCHEMA, diagnostics };
  const contractHash = createHash("sha256").update(canonicalJson(contract)).digest("hex");
  return { valid: true, executable: false, schema: TASK_CONTRACT_SCHEMA, contract, contractHash, diagnostics };
}
