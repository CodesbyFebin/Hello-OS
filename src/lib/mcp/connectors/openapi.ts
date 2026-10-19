// Technique 8: OpenAPI 3 -> MCP tool definitions. Produces *candidate* tool
// schemas only; it never calls the described API. Non-GET operations are
// excluded unless includeWrites is set, and are then marked approval-required.

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; requiresApproval: boolean; enabled: boolean };
  "x-openapi": { method: string; path: string; operationId?: string };
}

const METHODS = ["get", "head", "post", "put", "patch", "delete"] as const;

function resolveRef(doc: any, node: any, depth = 0): any {
  if (!node || typeof node !== "object" || depth > 8) return node;
  if (typeof node.$ref === "string") {
    if (!node.$ref.startsWith("#/")) return { description: `external $ref not resolved: ${node.$ref}` };
    const target = node.$ref.slice(2).split("/").reduce((o: any, k: string) => o?.[k.replace(/~1/g, "/").replace(/~0/g, "~")], doc);
    return resolveRef(doc, target, depth + 1);
  }
  if (Array.isArray(node)) return node.map((n) => resolveRef(doc, n, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = resolveRef(doc, v, depth + 1);
  return out;
}

function toolName(method: string, path: string, opId?: string) {
  const raw = opId || `${method}_${path.replace(/[{}]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}`;
  return raw.replace(/[^A-Za-z0-9_.-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 64);
}

export function reflectOpenApi(spec: unknown, opts: { includeWrites?: boolean; prefix?: string } = {}) {
  const doc: any = typeof spec === "string" ? JSON.parse(spec) : spec;
  if (!doc || typeof doc !== "object" || typeof doc.openapi !== "string" || !doc.openapi.startsWith("3.")) throw new Error("expected an OpenAPI 3.x document (JSON)");
  const tools: McpToolDef[] = [];
  const skipped: { method: string; path: string; reason: string }[] = [];
  for (const [path, item] of Object.entries<any>(doc.paths ?? {})) {
    for (const method of METHODS) {
      const op = item?.[method];
      if (!op) continue;
      const write = method !== "get" && method !== "head";
      if (write && !opts.includeWrites) { skipped.push({ method: method.toUpperCase(), path, reason: "write operation excluded (set includeWrites to emit as approval-required)" }); continue; }
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const p of [...(item.parameters ?? []), ...(op.parameters ?? [])].map((x: any) => resolveRef(doc, x))) {
        if (!p?.name || p.in === "cookie") continue;
        properties[p.name] = { ...(p.schema ?? { type: "string" }), description: [p.in, p.description].filter(Boolean).join(": ") };
        if (p.required || p.in === "path") required.push(p.name);
      }
      const body = resolveRef(doc, op.requestBody);
      const json = body?.content?.["application/json"]?.schema;
      if (json) { properties.body = json; if (body.required) required.push("body"); }
      const name = (opts.prefix ? `${opts.prefix}.` : "") + toolName(method, path, op.operationId);
      tools.push({
        name,
        description: (op.summary || op.description || `${method.toUpperCase()} ${path}`).slice(0, 500),
        inputSchema: { type: "object", properties, ...(required.length ? { required: [...new Set(required)] } : {}) },
        annotations: { readOnlyHint: !write, destructiveHint: method === "delete", requiresApproval: write, enabled: !write },
        "x-openapi": { method: method.toUpperCase(), path, operationId: op.operationId },
      });
    }
  }
  return { title: doc.info?.title ?? null, version: doc.info?.version ?? null, toolCount: tools.length, tools, skipped, note: "Candidate definitions only. Review authorization and side effects before exposing any tool." };
}
