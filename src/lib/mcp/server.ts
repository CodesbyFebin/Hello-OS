// hello-mcp core — runtime-agnostic MCP server for hello.forge + hello.cortex.
// Runs in-process inside Next (src/app/api/hello/*) and in the optional Bun
// sidecar (mini-services/hello-mcp), which only wraps handleMcpRequest.
//
// Any agent (Claude Code, Gemini, Cursor, custom) can connect. Paths below are
// relative to /api/hello in Next, or to the sidecar root:
//   GET  /              → hello.json handshake manifest (the agent bootstrap)
//   GET  /tools         → MCP tools/list  (tool registry with input schemas)
//   POST /tools/call    → MCP tools/call  (invoke a tool, get structured result)
//   GET  /feed          → JSON snapshot of recent tool calls (for the observer HUD)
//
// Every tool call is logged with a SHA-256 receipt. The forge tools run REAL
// ts-morph AST operations; the cortex tools read/write the shared DB.

import { db } from "@/lib/db";
import { listSymbols, typecheck, patchSymbol, estimateTokens, type ForgeSymbol, type ForgeDiagnostic } from "@/lib/forge";
import { compileAml } from "@/lib/aml";
import { createHash } from "crypto";
import pkg from "../../../package.json" with { type: "json" };
import { connectorTools } from "@/lib/mcp/connectors";

export const MCP_PROTOCOL_VERSION = "2026-07-28";

// ─── MCP tool registry ───────────────────────────────────────────
export interface Tool {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, any>; required?: string[] };
  handler: (args: any) => Promise<any>;
}

export const tools: Tool[] = [
  // ── hello.forge ──
  {
    name: "forge.listSymbols",
    description: "Parse the repository into AST symbols. Returns classes, methods, functions, interfaces with deterministic astNodeIds, signatures, and return types. Agents read symbols, not raw text.",
    inputSchema: { type: "object", properties: { repoId: { type: "string", default: "logistics" } } },
    handler: async (args) => {
      const symbols = listSymbols(args.repoId ?? "logistics");
      return {
        repoId: args.repoId ?? "logistics",
        symbolCount: symbols.length,
        symbols: symbols.map((s) => ({
          qualifiedName: s.qualifiedName,
          kind: s.kind,
          astNodeId: s.astNodeId,
          signature: s.signature,
          returnType: s.returnType,
          filePath: s.filePath,
          hasDiagnostics: s.hasDiagnostics,
        })),
      };
    },
  },
  {
    name: "forge.readSymbol",
    description: "Read a single symbol's full source + AST metadata by qualifiedName or astNodeId. Returns the symbol body so an agent can inspect it without loading the whole file.",
    inputSchema: {
      type: "object",
      properties: {
        repoId: { type: "string", default: "logistics" },
        qualifiedName: { type: "string", description: "e.g. 'DurableJobScheduler.processNextDueJob'" },
      },
      required: ["qualifiedName"],
    },
    handler: async (args) => {
      const symbols = listSymbols(args.repoId ?? "logistics");
      const sym = symbols.find((s) => s.qualifiedName === args.qualifiedName);
      if (!sym) return { error: "symbol not found", qualifiedName: args.qualifiedName };
      const { ...rest } = sym;
      return rest;
    },
  },
  {
    name: "forge.typecheck",
    description: "Run the TypeScript compiler (ts-morph) on a file or the whole repo. Returns structured JSON diagnostics — errorCode, symbol, expectedType, receivedType, suggestedFix. This is the instant diagnostic engine.",
    inputSchema: {
      type: "object",
      properties: {
        repoId: { type: "string", default: "logistics" },
        filePath: { type: "string", description: "optional: typecheck a single file" },
      },
    },
    handler: async (args) => {
      const diags = typecheck(args.repoId ?? "logistics", args.filePath);
      const errors = diags.filter((d) => d.category === "error");
      return {
        status: errors.length === 0 ? "OK" : "REJECTED_COMPILE",
        errorCount: errors.length,
        warningCount: diags.filter((d) => d.category === "warning").length,
        diagnostics: diags,
      };
    },
  },
  {
    name: "forge.patchSymbol",
    description: "Patch a symbol's body by astNodeId. Re-runs the typecheck immediately and returns VERIFIED or REJECTED_COMPILE with diagnostics. Pre-commit speculative execution.",
    inputSchema: {
      type: "object",
      properties: {
        repoId: { type: "string", default: "logistics" },
        astNodeId: { type: "string" },
        newBody: { type: "string", description: "the new method body (without signature)" },
      },
      required: ["astNodeId", "newBody"],
    },
    handler: async (args) => {
      const result = patchSymbol(args.repoId ?? "logistics", args.astNodeId, args.newBody);
      // Record the mutation
      const mut = await db.codeMutation.create({
        data: {
          repoId: args.repoId ?? "logistics",
          agentDid: args.agentDid ?? "did:key:unknown",
          astNodeId: args.astNodeId,
          symbolName: result.symbolName,
          oldSource: result.oldSource.slice(0, 2000),
          newSource: result.newSource.slice(0, 2000),
          status: result.status === "VERIFIED" ? "verified" : "rejected",
          diagnosticJson: JSON.stringify(result.diagnostics),
          receiptHash: sha256(`${args.astNodeId}:${args.newBody}:${Date.now()}`),
        },
      });
      return { ...result, mutationId: mut.id, receiptHash: mut.receiptHash };
    },
  },

  {
    name: "aml.compile",
    description: "Statically parse and validate AML declarations. This tool never executes the actions named in AML source.",
    inputSchema: { type: "object", properties: { source: { type: "string", description: "AML source, maximum 64 KB" } }, required: ["source"] },
    handler: async (args) => {
      if (typeof args.source !== "string") return { error: "source must be a string" };
      return compileAml(args.source);
    },
  },

  // ── hello.cortex ──
  {
    name: "cortex.recall",
    description: "Retrieve memories for a task with an explicit token budget. Ranks by relevance (tag/keyword match) and truncates to fit maxTokens. Context-budgeted retrieval.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "e.g. 'logistics/scheduler'" },
        maxTokens: { type: "number", default: 1500 },
        kind: { type: "string", description: "optional: filter by kind (causal_dead_end, semantic, constraint, episodic)" },
      },
      required: ["task"],
    },
    handler: async (args) => {
      const maxTokens = args.maxTokens ?? 1500;
      const memories = await db.cortexMemory.findMany({
        where: { AND: [args.kind ? { kind: args.kind } : {}, { task: { contains: args.task } }] },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      // Rank by tag/keyword overlap + dead-end count (causal dead-ends weighted higher)
      const taskTokens = new Set<string>(args.task.toLowerCase().split(/[/._-]+/).filter((t: string) => t.length > 2));
      const ranked = memories
        .map((m) => {
          let score = 0;
          const tagTokens = new Set(m.tags.toLowerCase().split(","));
          for (const t of taskTokens) if (tagTokens.has(t) || m.content.toLowerCase().includes(t)) score += 2;
          if (m.kind === "causal_dead_end") score += m.deadEndCount * 3;
          if (m.kind === "constraint") score += 5;
          return { m, score };
        })
        .sort((a, b) => b.score - a.score);

      // Truncate to token budget
      const result: any[] = [];
      let used = 0;
      for (const { m } of ranked) {
        if (used + m.tokenEstimate > maxTokens) break;
        result.push({
          id: m.id,
          kind: m.kind,
          task: m.task,
          content: m.content,
          tags: m.tags,
          errorSignature: m.errorSignature,
          deadEndCount: m.deadEndCount,
          tokenEstimate: m.tokenEstimate,
        });
        used += m.tokenEstimate;
      }
      return { task: args.task, budgetTokens: maxTokens, tokensUsed: used, memories: result.length, results: result };
    },
  },
  {
    name: "cortex.recordDeadEnd",
    description: "Record a causal dead-end — an approach that failed. Other agents will never waste tokens repeating the same mistake. Deduplicates by errorSignature.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string" },
        approach: { type: "string", description: "what was tried" },
        errorSignature: { type: "string", description: "e.g. 'TS2322:PromiseMismatch'" },
        content: { type: "string", description: "what went wrong + the fix" },
      },
      required: ["task", "content", "errorSignature"],
    },
    handler: async (args) => {
      // Dedup by errorSignature + task — increment deadEndCount if seen before
      const existing = await db.cortexMemory.findFirst({
        where: { task: args.task, errorSignature: args.errorSignature, kind: "causal_dead_end" },
      });
      if (existing) {
        const updated = await db.cortexMemory.update({
          where: { id: existing.id },
          data: { deadEndCount: { increment: 1 } },
        });
        return { recorded: true, deduplicated: true, deadEndCount: updated.deadEndCount, id: updated.id };
      }
      const created = await db.cortexMemory.create({
        data: {
          kind: "causal_dead_end",
          agentDid: args.agentDid ?? "did:key:unknown",
          task: args.task,
          content: args.content,
          errorSignature: args.errorSignature,
          deadEndCount: 1,
          tokenEstimate: estimateTokens(args.content),
          tags: args.tags ?? "",
        },
      });
      return { recorded: true, deduplicated: false, deadEndCount: 1, id: created.id };
    },
  },
  {
    name: "cortex.proposeContract",
    description: "Propose a contract lock on the mesh. Intent types: SPEC_PROPOSAL, INTERFACE_LOCK, ADVERSARIAL_AUDIT, TASK_BOUNTY. Other agents can challenge or verify.",
    inputSchema: {
      type: "object",
      properties: {
        intentType: { type: "string", enum: ["SPEC_PROPOSAL", "INTERFACE_LOCK", "ADVERSARIAL_AUDIT", "TASK_BOUNTY"] },
        title: { type: "string" },
        schemaJson: { type: "string", description: "the locked contract (OpenAPI, SQL schema, test suite)" },
        participants: { type: "string", description: "comma-separated agent DIDs" },
      },
      required: ["intentType", "title"],
    },
    handler: async (args) => {
      const contract = await db.contractLock.create({
        data: {
          intentType: args.intentType,
          title: args.title,
          proposerDid: args.agentDid ?? "did:key:unknown",
          participants: args.participants ?? "",
          schemaJson: args.schemaJson ?? "{}",
          status: "proposed",
          receiptHash: sha256(`${args.intentType}:${args.title}:${Date.now()}`),
        },
      });
      return { contractId: contract.id, intentType: args.intentType, status: "proposed", receiptHash: contract.receiptHash };
    },
  },
  {
    name: "cortex.lockInterface",
    description: "Transition a contract from 'proposed' to 'locked'. INTERFACE_LOCK prevents either side from breaking the other's contract.",
    inputSchema: {
      type: "object",
      properties: { contractId: { type: "string" } },
      required: ["contractId"],
    },
    handler: async (args) => {
      const c = await db.contractLock.update({
        where: { id: args.contractId },
        data: { status: "locked", lockedAt: new Date() },
      });
      return { contractId: c.id, status: "locked", lockedAt: c.lockedAt };
    },
  },
  {
    name: "cortex.listContracts",
    description: "List active contract locks on the mesh — the shared contract bus.",
    inputSchema: { type: "object", properties: { status: { type: "string" } } },
    handler: async (args) => {
      const contracts = await db.contractLock.findMany({
        where: args.status ? { status: args.status } : {},
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return { contracts, count: contracts.length };
    },
  },

  // ── hello.memory ──
  {
    name: "memory.recall",
    description: "Search one agent's tiered temporal memory within a token budget. CORE, RECALL, and ARCHIVE are supported.",
    inputSchema: { type: "object", properties: { agentId: { type: "string" }, q: { type: "string" }, tier: { type: "string" }, maxTokens: { type: "number", default: 1500 } }, required: ["agentId", "q"] },
    handler: async (args) => {
      const maxTokens = Math.min(Math.max(Number(args.maxTokens || 1500), 1), 10000);
      const tiers: Record<string, string[]> = { CORE: ["CORE", "RAM"], RECALL: ["RECALL", "STORE"], ARCHIVE: ["ARCHIVE"] };
      const requested = String(args.tier || "").toUpperCase();
      if (requested && !tiers[requested]) throw new Error("tier must be CORE, RECALL, or ARCHIVE");
      const memories = await db.memory.findMany({ where: { agentId: args.agentId, ...(requested ? { tier: { in: tiers[requested] } } : {}), OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { updatedAt: "desc" }, take: 300 });
      const terms = [...new Set(String(args.q).toLowerCase().split(/\W+/).filter((term: string) => term.length > 2))];
      const ranked = memories.map((m) => ({ m, score: terms.reduce((score, term) => score + (`${m.content} ${m.tags} ${m.kind}`.toLowerCase().includes(term) ? 1 : 0), 0) })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || b.m.updatedAt.getTime() - a.m.updatedAt.getTime());
      let used = 0;
      const results = ranked.filter(({ m }) => { const estimate = Math.max(1, Math.ceil(m.content.length / 4)); if (used + estimate > maxTokens) return false; used += estimate; return true; }).map(({ m }) => ({ id: m.id, tier: m.tier, kind: m.kind, content: m.content, tags: m.tags, confidence: m.confidence, validFrom: m.validFrom, validTo: m.validTo, tokenEstimate: Math.max(1, Math.ceil(m.content.length / 4)) }));
      return { agentId: args.agentId, budgetTokens: maxTokens, tokensUsed: used, results };
    },
  },
  {
    name: "memory.write",
    description: "Write a time-aware memory to CORE, RECALL, or ARCHIVE with a bounded lifetime.",
    inputSchema: { type: "object", properties: { agentId: { type: "string" }, tier: { type: "string", default: "RECALL" }, kind: { type: "string", default: "episodic" }, content: { type: "string" }, tags: { type: "string" }, ttl: { type: "string", default: "permanent" }, provenance: { type: "string" } }, required: ["agentId", "content"] },
    handler: async (args) => {
      const tier = String(args.tier || "RECALL").toUpperCase();
      const ttl = String(args.ttl || "permanent");
      if (!["CORE", "RECALL", "ARCHIVE"].includes(tier)) throw new Error("tier must be CORE, RECALL, or ARCHIVE");
      if (!["permanent", "session", "7d", "30d"].includes(ttl)) throw new Error("ttl must be permanent, session, 7d, or 30d");
      if (typeof args.content !== "string" || !args.content.trim()) throw new Error("content is required");
      const expiresAt = ttl === "session" ? new Date(Date.now() + 3600_000) : ttl === "7d" ? new Date(Date.now() + 7 * 86400_000) : ttl === "30d" ? new Date(Date.now() + 30 * 86400_000) : null;
      const memory = await db.memory.create({ data: { agentId: args.agentId, tier, kind: args.kind || "episodic", content: args.content.trim(), tags: args.tags || "", provenance: args.provenance || "mcp", ttl, expiresAt, validFrom: new Date() } });
      return { id: memory.id, agentId: memory.agentId, tier: memory.tier, expiresAt: memory.expiresAt, createdAt: memory.createdAt };
    },
  },

  // ── hello.cloud ──
  {
    name: "cloud.checkpoint",
    description: "SIMULATION: records a named checkpoint row before a risky mutation. No database or filesystem snapshot is taken; the snapshot refs are labels only. Copy-on-write and Firecracker are not built.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, repoId: { type: "string", default: "logistics" } },
      required: ["name"],
    },
    handler: async (args) => {
      const cp = await db.checkpoint.create({
        data: {
          repoId: args.repoId ?? "logistics",
          name: args.name,
          agentDid: args.agentDid ?? "did:key:unknown",
          dbSnapshotRef: `cow:pg:${sha256(args.name + Date.now()).slice(0, 12)}`,
          fsSnapshotRef: `cow:fs:${sha256(args.name + Date.now() + "fs").slice(0, 12)}`,
          status: "active",
          receiptHash: sha256(`ckpt:${args.name}:${Date.now()}`),
        },
      });
      return { checkpointId: cp.id, name: cp.name, dbSnapshot: cp.dbSnapshotRef, fsSnapshot: cp.fsSnapshotRef, status: "active", receiptHash: cp.receiptHash, simulated: true, note: "No data was snapshotted; refs are labels." };
    },
  },
  {
    name: "cloud.rollback",
    description: "SIMULATION: marks a checkpoint row as rolled_back. It does not restore any database or filesystem state.",
    inputSchema: { type: "object", properties: { checkpointId: { type: "string" } }, required: ["checkpointId"] },
    handler: async (args) => {
      const cp = await db.checkpoint.update({
        where: { id: args.checkpointId },
        data: { status: "rolled_back" },
      });
      return { checkpointId: cp.id, status: "rolled_back", restoredTo: cp.name, simulated: true, note: "Status change only; no state was restored." };
    },
  },
  // ── connectors (read-only adapters; see docs/bridges.md) ──
  ...connectorTools(db as any),
];

// ─── hello.json handshake manifest ────────────────────────────────
export function handshakeManifest(baseUrl: string = process.env.HELLO_PUBLIC_URL || "http://localhost:3000/api/hello") {
  return {
    platform: "HELLO_AGENT_OS",
    version: pkg.version,
    humanGuiPresent: false,
    endpoint: `${baseUrl}/mcp`,
    principles: [
      "NEVER_WAIT_ON_POLLING: Subscribe to deterministic state events.",
      "CHECKPOINT_BEFORE_MUTATE: Always fork state before destructive ops.",
      "AST_OVER_RAW_TEXT: Read and mutate symbols, not raw file blobs.",
      "PROOF_OVER_PROMISE: No task transitions to DONE without a signed test receipt.",
    ],
    capabilities: {
      forge: { endpoint: "/tools/call", tools: ["forge.listSymbols", "forge.readSymbol", "forge.typecheck", "forge.patchSymbol"] },
      aml: { endpoint: "/tools/call", tools: ["aml.compile"] },
      cortex: { endpoint: "/tools/call", tools: ["cortex.recall", "cortex.recordDeadEnd", "cortex.proposeContract", "cortex.lockInterface", "cortex.listContracts"] },
      cloud: { endpoint: "/tools/call", tools: ["cloud.checkpoint", "cloud.rollback"] },
      connectors: { endpoint: "/tools/call", tools: tools.filter((t) => t.name.startsWith("connector.")).map((t) => t.name), readOnly: true },
    },
    toolCount: tools.length,
    mcpProtocol: `MCP Streamable HTTP ${MCP_PROTOCOL_VERSION}; JSON-RPC endpoint: /mcp. Compatibility routes: GET /tools and POST /tools/call.`,
    note: "Every tool call is logged with a SHA-256 receipt. forge tools run real ts-morph AST operations.",
  };
}

// ─── HTTP server ──────────────────────────────────────────────────
export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function logToolCall(toolName: string, args: any, result: any, latencyMs: number, isError: boolean, agentDid?: string) {
  const argsJson = JSON.stringify(args);
  const resultJson = JSON.stringify(result);
  const receiptHash = sha256(`${toolName}:${argsJson}:${resultJson}:${Date.now()}`);
  try {
    await db.mcpToolCall.create({
      data: { agentDid: agentDid ?? null, toolName, argumentsJson: argsJson, resultJson: resultJson.slice(0, 8000), isError, latencyMs, receiptHash },
    });
  } catch (e) {
    console.error("[logToolCall] failed:", e);
  }
}


/** Fetch-standard handler shared by Next route handlers and the Bun sidecar.
 *  `pathname` is the MCP-relative path: "/", "/tools", "/tools/call", "/feed" or "/mcp". */
export async function handleMcpRequest(req: Request, pathname: string): Promise<Response> {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
      "Access-Control-Expose-Headers": "MCP-Protocol-Version",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    // GET / → hello.json handshake
    if (pathname === "/" && req.method === "GET") {
      return Response.json(handshakeManifest(), { headers: cors });
    }

    // MCP Streamable HTTP uses one JSON-RPC POST endpoint. Notifications are
    // accepted without a response body; calls return a JSON response.
    if (pathname === "/mcp" && req.method === "POST") {
      const origin = req.headers.get("origin");
      const allowedOrigins = (process.env.HELLO_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3030,http://127.0.0.1:3030").split(",").map((value) => value.trim());
      if (origin && !allowedOrigins.includes(origin)) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32020, message: "Origin is not allowed" } }, { status: 403, headers: cors });
      const body = await req.json().catch(() => null);
      if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid JSON-RPC request" } }, { status: 400, headers: cors });
      const versionHeader = req.headers.get("mcp-protocol-version");
      const bodyVersion = body._meta?.["io.modelcontextprotocol/protocolVersion"];
      const declaredMethod = req.headers.get("mcp-method");
      const accept = req.headers.get("accept") || "";
      if (!accept.includes("application/json") || versionHeader !== MCP_PROTOCOL_VERSION || bodyVersion !== versionHeader || declaredMethod !== body.method) {
        return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32020, message: "MCP method or protocol version header mismatch" } }, { status: 400, headers: cors });
      }
      const params = body.params || {};
      if (body.method === "tools/call" && req.headers.get("mcp-name") !== params.name) return Response.json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32020, message: "Mcp-Name must match params.name" } }, { status: 400, headers: cors });
      if (body.id === undefined || body.method.startsWith("notifications/")) return new Response(null, { status: 202, headers: cors });

      const rpc = async (result: unknown, status = 200) => Response.json({ jsonrpc: "2.0", id: body.id, result }, { status, headers: { ...cors, "MCP-Protocol-Version": MCP_PROTOCOL_VERSION } });
      if (body.method === "initialize") return rpc({ protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false } }, serverInfo: { name: "hello-agent-os", version: pkg.version } });
      if (body.method === "ping") return rpc({});
      if (body.method === "tools/list") return rpc({ tools: tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })) });
      if (body.method === "tools/call") {
        const tool = tools.find((item) => item.name === params.name);
        if (!tool) return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32602, message: `unknown tool: ${params.name}` } }, { status: 400, headers: cors });
        const args = params.arguments || {};
        const agentDid = params._meta?.agentDid || args.agentDid;
        const started = Date.now();
        try {
          const result = await tool.handler({ ...args, agentDid });
          const latencyMs = Date.now() - started;
          await logToolCall(tool.name, args, result, latencyMs, false, agentDid);
          return rpc({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result, isError: false });
        } catch (e: any) {
          const message = e instanceof Error ? e.message : "tool failed";
          await logToolCall(tool.name, args, { error: message }, Date.now() - started, true, agentDid);
          return rpc({ content: [{ type: "text", text: `Error: ${message}` }], isError: true });
        }
      }
      if (body.method === "resources/list") return rpc({ resources: [
        { uri: "hello://handshake", name: "HELLO handshake", mimeType: "application/json" },
        { uri: "hello://mcp/tools", name: "HELLO MCP tools", mimeType: "application/json" },
        { uri: "hello://mcp/feed", name: "Recent tool call receipts", mimeType: "application/json" },
      ] });
      if (body.method === "resources/read") {
        const resource = String(params.uri || "");
        let contents: unknown;
        if (resource === "hello://handshake") contents = handshakeManifest();
        else if (resource === "hello://mcp/tools") contents = tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
        else if (resource === "hello://mcp/feed") contents = await db.mcpToolCall.findMany({ take: 30, orderBy: { createdAt: "desc" } });
        else return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32602, message: "unknown resource URI" } }, { status: 400, headers: cors });
        return rpc({ contents: [{ uri: resource, mimeType: "application/json", text: JSON.stringify(contents) }] });
      }
      if (body.method === "prompts/list") return rpc({ prompts: [] });
      return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `method not found: ${body.method}` } }, { status: 404, headers: cors });
    }

    // GET /tools → MCP tools/list
    if (pathname === "/tools" && req.method === "GET") {
      return Response.json({
        tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      }, { headers: cors });
    }

    // POST /tools/call → MCP tools/call
    if (pathname === "/tools/call" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { name, arguments: args, agentDid } = body;
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        return Response.json({ error: `unknown tool: ${name}`, available: tools.map((t) => t.name) }, { status: 404, headers: cors });
      }
      const t0 = Date.now();
      try {
        const result = await tool.handler({ ...args, agentDid });
        const latencyMs = Date.now() - t0;
        await logToolCall(name, args, result, latencyMs, false, agentDid);
        // MCP tools/call response shape
        return Response.json({
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: false,
          latencyMs,
          receipt: sha256(`${name}:${Date.now()}`),
        }, { headers: cors });
      } catch (e: any) {
        const latencyMs = Date.now() - t0;
        await logToolCall(name, args, { error: e.message }, latencyMs, true, agentDid);
        return Response.json({
          content: [{ type: "text", text: `Error: ${e.message}` }],
          isError: true,
          latencyMs,
        }, { status: 500, headers: cors });
      }
    }

    // GET /feed → recent tool calls (for the observer HUD)
    if (pathname === "/feed" && req.method === "GET") {
      const calls = await db.mcpToolCall.findMany({
        take: 30,
        orderBy: { createdAt: "desc" },
      });
      return Response.json({ calls }, { headers: cors });
    }

    return Response.json({ error: "not found", endpoints: ["/", "/tools", "/tools/call", "/feed", "/mcp"] }, { status: 404, headers: cors });
}
