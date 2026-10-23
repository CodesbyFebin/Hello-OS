// The hub. Every import produces a PortableSession; every export consumes one.
// v1 fidelity: text turns only (tool_use / tool_result / thinking dropped at import).
// See ../../docs/HUB-IR.md for the full rationale.

import { z } from "zod"

export const HarnessId = z.enum(["claude-code", "codex", "opencode"])
export type HarnessId = z.infer<typeof HarnessId>

export const PortableTurn = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(), // rendered text only; structural tool/thinking blocks are not carried in v1
  timestamp: z.number().int().optional(), // epoch ms
  model: z.string().optional(), // provenance only
})
export type PortableTurn = z.infer<typeof PortableTurn>

export const PortableSession = z.object({
  schemaVersion: z.literal("1.0.0"),
  sourceHarness: HarnessId,
  sourceSessionId: z.string().min(1), // native id — the idempotency key
  sourcePath: z.string(), // machine-local provenance only
  cwd: z.string(), // authoritative working dir (never re-derive from encoded names)
  title: z.string(),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
  turns: z.array(PortableTurn),
  droppedTurns: z.number().int().nonnegative(), // tool-only / thinking-only turns skipped, counted not stored
  sourceMetadata: z.record(z.unknown()), // lossless bag: gitBranch, version, tokens, turn_ids, ...
})
export type PortableSession = z.infer<typeof PortableSession>

export const SCHEMA_VERSION = "1.0.0" as const
