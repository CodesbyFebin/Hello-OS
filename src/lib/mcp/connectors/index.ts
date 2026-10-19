// MCP tool registrations for the connector adapters. All are read-only.
// Imported by mini-services/hello-mcp. No write/high-risk connector tools exist.
import { readOnlyQuery, reflectSchema, type RawQueryClient } from "./sql";
import { schemaFingerprint, diffSchemas } from "./fingerprint";
import { githubRead } from "./github";
import { reflectOpenApi } from "./openapi";
import { transpileWebhook } from "./webhook";

export interface ConnectorTool {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, any>; required?: string[] };
  handler: (args: any) => Promise<any>;
}

export function connectorTools(db: RawQueryClient): ConnectorTool[] {
  return [
    {
      name: "connector.sql.query",
      description: "Read-only SQL against the HELLO datasource. Single SELECT/WITH only; results capped (default 50, max 200 rows).",
      inputSchema: { type: "object", properties: { sql: { type: "string" }, limit: { type: "number", default: 50 } }, required: ["sql"] },
      handler: async (a) => { try { return await readOnlyQuery(db, a.sql, a.limit); } catch (e) { return { error: (e as Error).message }; } },
    },
    {
      name: "connector.sql.schema",
      description: "Reflect tables and columns of the HELLO datasource.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ tables: await reflectSchema(db) }),
    },
    {
      name: "connector.sql.fingerprint",
      description: "SHA-256 fingerprint of the reflected schema. Pass expected to detect drift.",
      inputSchema: { type: "object", properties: { expected: { type: "string" } } },
      handler: async (a) => { const fp = schemaFingerprint(await reflectSchema(db)); return { ...fp, matchesExpected: a.expected ? a.expected === fp.fingerprint : null }; },
    },
    {
      name: "connector.github.read",
      description: "Read-only GitHub REST: repo metadata, issues, or pull requests. Uses GITHUB_TOKEN from env if set (never returned).",
      inputSchema: { type: "object", properties: { resource: { type: "string", enum: ["repo", "issues", "pulls"] }, owner: { type: "string" }, repo: { type: "string" }, state: { type: "string", enum: ["open", "closed", "all"] }, perPage: { type: "number" } }, required: ["resource", "owner", "repo"] },
      handler: async (a) => { try { return await githubRead(a); } catch (e) { return { error: (e as Error).message }; } },
    },
    {
      name: "connector.openapi.reflect",
      description: "Turn an OpenAPI 3 JSON document into candidate MCP tool definitions. Never calls the API. Write operations excluded unless includeWrites, then marked approval-required and disabled.",
      inputSchema: { type: "object", properties: { spec: { type: ["object", "string"] }, includeWrites: { type: "boolean", default: false }, prefix: { type: "string" } }, required: ["spec"] },
      handler: async (a) => { try { return reflectOpenApi(a.spec, a); } catch (e) { return { error: (e as Error).message }; } },
    },
    {
      name: "connector.webhook.transpile",
      description: "Map a webhook event + payload to a typed intent record (observe-only). Signature verification happens at POST /api/integrations/webhook.",
      inputSchema: { type: "object", properties: { event: { type: "string" }, payload: { type: "object" } }, required: ["event", "payload"] },
      handler: async (a) => transpileWebhook(String(a.event), a.payload),
    },
  ];
}

export { diffSchemas };
