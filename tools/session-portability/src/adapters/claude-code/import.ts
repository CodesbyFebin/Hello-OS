// Claude Code IMPORT adapter — spoke -> Hub IR.
// Wraps the vendored stdlib-only parser/discovery/ledger core (copied from
// opencode-port/) and maps its ParsedSession onto the S0 PortableSession contract.
//
// Reconciliation (S8) registers this with `registerImport(claudeCodeImport)`.

import fs from "fs"
import { PortableSession, type HarnessId } from "../../ir"
import type { ImportAdapter, SessionRef } from "../../adapter"
import * as ClaudeParser from "./parser"
import * as ClaudeDiscovery from "./discovery"
import type { ParsedSession } from "./parser"

const HARNESS: HarnessId = "claude-code"

/** Map the parser's ParsedSession onto the canonical PortableSession IR. */
export function toPortable(p: ParsedSession): PortableSession {
  const turns = p.turns.map((t) => ({
    role: t.role,
    text: t.text,
    timestamp: t.timestamp,
    model: t.model,
  }))
  const first = turns[0]
  const last = turns[turns.length - 1]

  // AC7: malformed JSONL lines are surfaced (not silently dropped) via a
  // skipReasons entry in the lossless sourceMetadata bag — only added when
  // there's actually something to report, so the common (clean-file) case
  // keeps sourceMetadata exactly { lineCount }.
  const sourceMetadata: Record<string, unknown> = { lineCount: p.lineCount }
  if (p.skippedLines.length > 0) sourceMetadata.skippedLines = p.skippedLines

  const obj = {
    schemaVersion: "1.0.0" as const,
    sourceHarness: HARNESS,
    sourceSessionId: p.claudeSessionID,
    sourcePath: p.sourcePath,
    cwd: p.directory,
    title: p.title,
    createdAt: first?.timestamp,
    updatedAt: last?.timestamp,
    turns,
    droppedTurns: p.skippedToolOnly,
    sourceMetadata,
  }

  // Validate at the seam: every adapter's output must pass PortableSession.parse().
  return PortableSession.parse(obj)
}

export const claudeCodeImport: ImportAdapter = {
  harness: HARNESS,

  async detect(): Promise<boolean> {
    return fs.existsSync(ClaudeParser.claudeProjectsRoot())
  },

  async discover(): Promise<SessionRef[]> {
    const sessions = await ClaudeDiscovery.listSessions()
    return sessions.map((s) => ({
      harness: HARNESS,
      sourceSessionId: s.claudeSessionID,
      sourcePath: s.sourcePath,
      title: s.title,
      updatedAt: s.mtime,
      imported: Boolean(s.imported),
      sourceChanged: s.imported ? s.imported.sourceChanged : false,
    }))
  },

  async parse(ref: SessionRef): Promise<PortableSession> {
    const parsed = ClaudeParser.parseSessionFile(ref.sourcePath)
    return toPortable(parsed)
  },
}
