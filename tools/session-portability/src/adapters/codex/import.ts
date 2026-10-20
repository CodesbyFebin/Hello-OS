// Codex IMPORT adapter (S2). Reads ~/.codex/sessions/**/rollout-*.jsonl -> Hub IR.
// v1 fidelity: user/assistant text turns only. reasoning + custom_tool_call(_output)
// are counted into droppedTurns; developer-role injected items and event_msg mirrors
// are skipped (response_item is preferred to avoid double-counting).
// See ../../../../docs/adapters/codex.md and docs/specs/S2.md.

import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { PortableSession } from "../../ir"
import type { PortableTurn } from "../../ir"
import type { ImportAdapter, SessionRef } from "../../adapter"
import { derivePreview } from "../../preview"

const HARNESS = "codex" as const

/** Codex root, honoring CODEX_HOME (defaults to ~/.codex). */
function codexHome(): string {
  const override = process.env.CODEX_HOME?.trim()
  return override && override.length > 0 ? override : join(homedir(), ".codex")
}

function sessionsDir(): string {
  return join(codexHome(), "sessions")
}

interface CodexRecord {
  timestamp?: string
  type?: string
  payload?: unknown
}

interface ContentPart {
  type?: string
  text?: string
}

/**
 * Tolerant JSONL parse — bad lines (malformed JSON, a truncated trailing line)
 * are skipped, never thrown (HUB-IR rule: don't crash on control junk). Each
 * skip is captured with a reason (line number + parse error) so parse() can
 * surface it instead of silently dropping data with no diagnostic (AC7).
 */
function parseLines(text: string): { records: CodexRecord[]; skipped: Array<{ line: number; reason: string }> } {
  const records: CodexRecord[] = []
  const skipped: Array<{ line: number; reason: string }> = []
  const rawLines = text.split("\n")
  rawLines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      records.push(JSON.parse(trimmed) as CodexRecord)
    } catch (err) {
      skipped.push({ line: idx + 1, reason: err instanceof Error ? err.message : String(err) })
    }
  })
  return { records, skipped }
}

function isoToEpoch(iso: unknown): number | undefined {
  if (typeof iso !== "string") return undefined
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? undefined : ms
}

/** Join the text of the content parts of the requested kind (input_text/output_text). */
function joinContent(content: unknown, wantType: string): string {
  if (!Array.isArray(content)) return ""
  return content
    .filter((c): c is ContentPart => !!c && typeof c === "object")
    .filter((c) => c.type === wantType && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n")
    .trim()
}

/** Display title: first meaningful user turn (command/boilerplate noise stripped). */
function codexTitle(turns: PortableTurn[]): string {
  return derivePreview(turns.filter((t) => t.role === "user").map((t) => t.text))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

interface Extracted {
  turns: PortableTurn[]
  droppedTurns: number
  meta: Record<string, unknown> | undefined
  turnContextCwd: string | undefined
  turnIds: string[]
  usedFallback: boolean
}

/**
 * Single-pass extraction shared by discover() and parse().
 * - response_item message role user -> input_text joined; assistant -> output_text joined.
 * - response_item reasoning / custom_tool_call / custom_tool_call_output -> droppedTurns++.
 * - developer-role messages + event_msg records: ignored (event_msg is a redundant UI mirror).
 * - Fallback: if NO response_item message turns exist, derive turns from event_msg
 *   user_message/agent_message so short/aborted sessions aren't empty. Guarded so the
 *   fallback can never run alongside response_item turns (no double counting).
 */
function extract(records: CodexRecord[]): Extracted {
  let meta: Record<string, unknown> | undefined
  let turnContextCwd: string | undefined
  const turns: PortableTurn[] = []
  let droppedTurns = 0
  const turnIds = new Set<string>()

  for (const rec of records) {
    const payload = asRecord(rec.payload)
    switch (rec.type) {
      case "session_meta": {
        if (!meta) meta = payload
        break
      }
      case "turn_context": {
        if (!turnContextCwd && typeof payload.cwd === "string") turnContextCwd = payload.cwd
        break
      }
      case "response_item": {
        const pType = payload.type
        if (pType === "message") {
          const role = payload.role
          if (role === "user" || role === "assistant") {
            const wantType = role === "user" ? "input_text" : "output_text"
            const text = joinContent(payload.content, wantType)
            if (text) {
              turns.push({ role, text, timestamp: isoToEpoch(rec.timestamp) })
            }
            const passthrough = asRecord(payload.internal_chat_message_metadata_passthrough)
            if (typeof passthrough.turn_id === "string") turnIds.add(passthrough.turn_id)
          }
          // developer-role (AGENTS.md / permissions) and any other role: skip, not counted.
        } else if (
          pType === "reasoning" ||
          pType === "custom_tool_call" ||
          pType === "custom_tool_call_output"
        ) {
          droppedTurns++
        }
        break
      }
      // event_msg: ignored here; handled only in the guarded fallback below.
    }
  }

  let usedFallback = false
  if (turns.length === 0) {
    for (const rec of records) {
      if (rec.type !== "event_msg") continue
      const payload = asRecord(rec.payload)
      const text = typeof payload.message === "string" ? payload.message.trim() : ""
      if (!text) continue
      if (payload.type === "user_message") {
        turns.push({ role: "user", text, timestamp: isoToEpoch(rec.timestamp) })
        usedFallback = true
      } else if (payload.type === "agent_message") {
        turns.push({ role: "assistant", text, timestamp: isoToEpoch(rec.timestamp) })
        usedFallback = true
      }
    }
  }

  return { turns, droppedTurns, meta, turnContextCwd, turnIds: [...turnIds], usedFallback }
}

async function listRolloutFiles(dir: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(dir, { recursive: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => /rollout-.*\.jsonl$/.test(e))
    .map((e) => join(dir, e))
}

export const codexImport: ImportAdapter = {
  harness: HARNESS,

  async detect(): Promise<boolean> {
    return existsSync(sessionsDir())
  },

  async discover(): Promise<SessionRef[]> {
    const dir = sessionsDir()
    if (!existsSync(dir)) return []
    const files = await listRolloutFiles(dir)

    const refs: Array<SessionRef & { _sortTs: number }> = []
    for (const file of files) {
      let text: string
      try {
        text = await readFile(file, "utf8")
      } catch {
        continue
      }
      const { records } = parseLines(text)
      const { turns, meta } = extract(records)
      const sessionId = typeof meta?.session_id === "string" ? meta.session_id : undefined
      if (!sessionId) continue // no session_meta -> not a valid rollout
      if (turns.length === 0) continue // aborted / no-turn session -> skip

      const lastTs = turns.at(-1)?.timestamp
      const metaTs = isoToEpoch(meta?.timestamp) ?? isoToEpoch(records[0]?.timestamp)
      const updatedAt = lastTs ?? metaTs
      refs.push({
        harness: HARNESS,
        sourceSessionId: sessionId,
        sourcePath: file,
        title: codexTitle(turns),
        updatedAt,
        _sortTs: updatedAt ?? 0,
      })
    }

    refs.sort((a, b) => b._sortTs - a._sortTs || b.sourcePath.localeCompare(a.sourcePath))
    return refs.map(({ _sortTs, ...ref }) => ref)
  },

  async parse(ref: SessionRef): Promise<PortableSession> {
    const text = await readFile(ref.sourcePath, "utf8")
    const { records, skipped: skippedLines } = parseLines(text)
    const { turns, droppedTurns, meta, turnContextCwd, turnIds } = extract(records)

    const sessionId =
      typeof meta?.session_id === "string" && meta.session_id.length > 0
        ? meta.session_id
        : ref.sourceSessionId
    const cwd =
      (typeof meta?.cwd === "string" && meta.cwd) || turnContextCwd || ""
    const createdAt = isoToEpoch(meta?.timestamp) ?? isoToEpoch(records[0]?.timestamp)
    const updatedAt = turns.at(-1)?.timestamp ?? createdAt

    const baseInstructions = asRecord(meta?.base_instructions)
    const sourceMetadata: Record<string, unknown> = {
      cli_version: meta?.cli_version,
      model_provider: meta?.model_provider,
      originator: meta?.originator,
      turn_ids: turnIds,
    }
    if (typeof baseInstructions.text === "string") {
      sourceMetadata.base_instructions_text = baseInstructions.text
    }
    // AC7: surface malformed-line skip reasons instead of silently dropping them.
    if (skippedLines.length > 0) sourceMetadata.skippedLines = skippedLines

    return PortableSession.parse({
      schemaVersion: "1.0.0",
      sourceHarness: HARNESS,
      sourceSessionId: sessionId,
      sourcePath: ref.sourcePath,
      cwd,
      title: codexTitle(turns),
      createdAt,
      updatedAt,
      turns,
      droppedTurns,
      sourceMetadata,
    })
  },
}
