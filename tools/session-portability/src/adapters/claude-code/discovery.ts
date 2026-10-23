// Discovery — list Claude conversation files and join with the import ledger.
// Used by a CLI (picks a default target) and any UI (populates an importer modal).
// Newest first. No host dependencies.

import fs from "fs"
import { execSync } from "child_process"
import { previewSessionFile, claudeProjectsRoot, type DiscoveryPreview } from "./parser"
import * as Ledger from "./ledger"
import { yieldToEventLoop } from "../../core/async-utils"

export type SessionStatus = DiscoveryPreview & {
  imported?: {
    targetSessionID: string
    importedAt: number
    lineCount: number
    /** True when the source .jsonl has grown since the import (continuation happened). */
    sourceChanged: boolean
  }
}

/** All Claude session files, sorted newest first. Excludes subagent transcripts. */
export function listClaudeSessionPaths(): string[] {
  const root = claudeProjectsRoot()
  if (!fs.existsSync(root)) return []
  const out = execSync(`find ${JSON.stringify(root)} -name '*.jsonl' -not -path '*/subagents/*'`, {
    encoding: "utf8",
  })
  return out
    .split("\n")
    .filter(Boolean)
    .map((f) => ({ f, m: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .map((x) => x.f)
}

/**
 * Full discovery list with previews + import status. Used by the modal.
 *
 * `previewSessionFile` reads each file's full contents synchronously (see
 * parser.ts) — on a store of hundreds of sessions that's hundreds of
 * milliseconds-to-seconds of uninterrupted synchronous work. A synchronous
 * `for` loop over that would starve the host's event loop for the whole
 * discovery pass: every `await` in this codebase's ledger/adapter chain
 * resolves via an already-settled promise (a microtask, not a real I/O
 * wait), and Node only advances to the timer/macrotask phase — where a TUI's
 * render loop and its `setInterval` spinners live — once the microtask queue
 * fully drains. A tight chain of microtask-only awaits never lets that queue
 * drain, so a caller with a live render loop (e.g. hello-sessions's TUI)
 * appears completely frozen, not just "no progress bar", for the entire
 * scan. Yielding to a real macrotask after every file breaks that chain.
 */
export async function listSessions(): Promise<SessionStatus[]> {
  const ledger = Ledger.read()
  const byID = new Map(ledger.records.map((r) => [r.claudeSessionID, r]))
  const out: SessionStatus[] = []
  for (const filePath of listClaudeSessionPaths()) {
    try {
      const preview = previewSessionFile(filePath)
      const rec = byID.get(preview.claudeSessionID)
      out.push({
        ...preview,
        imported: rec
          ? {
              targetSessionID: rec.targetSessionID,
              importedAt: rec.importedAt,
              lineCount: rec.lineCount,
              sourceChanged: rec.lineCount !== preview.lineCount,
            }
          : undefined,
      })
    } catch {
      // skip unreadable / malformed files silently — they shouldn't break the list
    }
    await yieldToEventLoop()
  }
  return out
}

/** Look up the .jsonl path for a Claude session UUID. Returns null if not found. */
export function findSessionPath(claudeSessionID: string): string | null {
  for (const filePath of listClaudeSessionPaths()) {
    const id = filePath.split("/").pop()?.replace(/\.jsonl$/, "")
    if (id === claudeSessionID) return filePath
  }
  return null
}

/**
 * CLI default-target picker:
 *   undefined / no arg → second-to-last by mtime (stable test target; most recent is
 *                        usually the live session that keeps mutating)
 *   "--latest"        → most recent
 *   anything else     → returned as-is (treated as an explicit path)
 */
export function pickDefault(arg?: string): string | undefined {
  if (arg && arg !== "--latest") return arg
  const sessions = listClaudeSessionPaths()
  if (arg === "--latest") return sessions[0]
  return sessions[1] ?? sessions[0]
}
