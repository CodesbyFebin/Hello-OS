// Import ledger — the source of truth for idempotency and teardown.
// One JSON file, dedup keyed on the Claude session UUID (the .jsonl filename).
// We dedup on UUID rather than a content hash on purpose: Claude session files
// grow as the user continues the conversation, so a hash treats every continuation
// as a brand-new session (codex has this bug). UUID matches one session forever.
//
// DECOUPLED from opencode: the ledger directory is configurable instead of
// hard-wired to Global.Path.data. Default ~/.claude-importer; override with
// setLedgerDir() or the CLAUDE_IMPORT_LEDGER_DIR env var.

import fs from "fs"
import os from "os"
import path from "path"

let LEDGER_DIR = process.env.CLAUDE_IMPORT_LEDGER_DIR || path.join(os.homedir(), ".claude-importer")

/** Point the ledger at a specific directory (e.g. the target host's data dir). */
export function setLedgerDir(dir: string): void {
  LEDGER_DIR = dir
}

export type LedgerRecord = {
  claudeSessionID: string
  sourcePath: string
  /** The id of the session created in the TARGET host (opencode, openclaw, hermes, …). */
  targetSessionID: string
  directory: string
  importedAt: number
  lineCount: number
}

export type Ledger = { records: LedgerRecord[] }

export function ledgerPath(): string {
  return path.join(LEDGER_DIR, "claude-import-ledger.json")
}

export function read(): Ledger {
  const p = ledgerPath()
  if (!fs.existsSync(p)) return { records: [] }
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"))
    if (!parsed || !Array.isArray(parsed.records)) return { records: [] }
    return parsed as Ledger
  } catch {
    return { records: [] }
  }
}

export function write(data: Ledger): void {
  const p = ledgerPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

export function findByClaudeID(claudeSessionID: string): LedgerRecord | undefined {
  return read().records.find((r) => r.claudeSessionID === claudeSessionID)
}

export function findByTargetID(targetSessionID: string): LedgerRecord | undefined {
  return read().records.find((r) => r.targetSessionID === targetSessionID)
}

export function append(record: LedgerRecord): void {
  const data = read()
  data.records.push(record)
  write(data)
}

export function removeByTargetID(targetSessionID: string): boolean {
  const data = read()
  const next = data.records.filter((r) => r.targetSessionID !== targetSessionID)
  if (next.length === data.records.length) return false
  write({ records: next })
  return true
}
