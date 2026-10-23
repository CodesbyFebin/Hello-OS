// S8 — the ONE idempotency authority for the whole tool.
//
// Prior to this revision, S1/S4/S5/S6 each shipped a private per-adapter export
// ledger with three incompatible shapes and force-passing conventions (see
// docs/specs/S8.md "Current State"). Per the 2026-07-01 eng review, this module
// replaces all three: it is the ONLY place idempotency state is kept, keyed on
// the triple `(sourceHarness, sourceSessionId, destHarness)` — the same source
// session can be exported to multiple destinations, and each pairing tracks its
// own state (see docs/HUB-IR.md "Idempotency semantics").
//
// Storage: one JSON file under the porter data dir
// (`$XDG_DATA_HOME/hello-sessions/ledger.json`, fallback
// `~/.local/share/hello-sessions/`). Keyed on native session ids, never a content
// hash (sessions grow on continuation; hashing would re-import them as dupes).
//
// Concurrency: writes MUST be serialized. Two concurrent `exportSessions()` calls
// racing on a naive read-modify-write would silently lose a record (eng-review
// finding P1) — `upsertRecord`/`removeRecord` are queued per ledger path via an
// in-process promise chain (`withLock`), so a second call's read always observes
// the first call's completed write.

import fs from "fs"
import path from "path"

import type { HarnessId } from "../ir"
import { defaultDataDir } from "./data-dir"

export interface LedgerKey {
  sourceHarness: HarnessId
  sourceSessionId: string
  destHarness: HarnessId
}

export interface LedgerRecord extends LedgerKey {
  /** Persistent destination identity (for update-in-place / teardown). */
  destSessionId: string
  /** Turn count at export time (v1: count-based: see eng-review decision A2). */
  sourceRevision: number
  exportedAt: number
}

export interface LedgerFile {
  records: LedgerRecord[]
}

// --- path resolution ---------------------------------------------------------

let ledgerPathOverride: string | undefined

/** Redirect the ledger at a specific file (tests point this at a temp path). */
export function setLedgerPath(p: string | undefined): void {
  ledgerPathOverride = p
}

/** Resolve the ledger file path: override > $HELLO_SESSIONS_LEDGER_PATH > $XDG_DATA_HOME/hello-sessions/ledger.json > ~/.local/share/hello-sessions/ledger.json. */
export function getLedgerPath(): string {
  return (
    ledgerPathOverride ?? process.env.HELLO_SESSIONS_LEDGER_PATH ?? path.join(defaultDataDir(), "ledger.json")
  )
}

// --- key helpers ---------------------------------------------------------------

function keyString(key: LedgerKey): string {
  return `${key.sourceHarness}\x00${key.sourceSessionId}\x00${key.destHarness}`
}

// --- raw file IO (never throws; corrupt/missing file reads as empty) -----------

function readFileRaw(p: string): LedgerFile {
  if (!fs.existsSync(p)) return { records: [] }
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"))
    if (!parsed || !Array.isArray(parsed.records)) return { records: [] }
    return parsed as LedgerFile
  } catch {
    return { records: [] }
  }
}

function writeFileRaw(p: string, data: LedgerFile): void {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

// --- serialization: one FIFO queue per ledger path ------------------------------
//
// Each queued function runs to completion (synchronously — no `await` inside)
// before the next one starts, so a read-modify-write is effectively atomic with
// respect to other calls through this module, no matter how many
// `exportSessions()` calls fire concurrently in the same process.

const queues = new Map<string, Promise<unknown>>()

function withLock<T>(key: string, fn: () => T): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve()
  const run = prev.then(fn, fn)
  // Keep the chain alive even if `fn` throws, but never let a queued rejection
  // propagate into the NEXT call's `prev` (that would only matter if we used
  // `.then(fn)` without a rejection handler above; we already pass `fn` as both
  // handlers, so `run` itself carries the real outcome for the caller).
  queues.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

// --- public API ------------------------------------------------------------

/** Read every record currently in the ledger (always re-reads disk — no cache). */
export async function listRecords(): Promise<LedgerRecord[]> {
  const p = getLedgerPath()
  return withLock(p, () => readFileRaw(p).records)
}

/** Look up the record for one (sourceHarness, sourceSessionId, destHarness) triple. */
export async function getRecord(key: LedgerKey): Promise<LedgerRecord | undefined> {
  const p = getLedgerPath()
  const target = keyString(key)
  return withLock(p, () => readFileRaw(p).records.find((r) => keyString(r) === target))
}

/** Insert or replace the record for its key. Read-modify-write, serialized (see withLock). */
export async function upsertRecord(record: LedgerRecord): Promise<void> {
  const p = getLedgerPath()
  const target = keyString(record)
  await withLock(p, () => {
    const data = readFileRaw(p)
    const next = data.records.filter((r) => keyString(r) !== target)
    next.push(record)
    writeFileRaw(p, { records: next })
  })
}

/** Remove the record for a key, if any. Returns true if a record was removed. */
export async function removeRecord(key: LedgerKey): Promise<boolean> {
  const p = getLedgerPath()
  const target = keyString(key)
  return withLock(p, () => {
    const data = readFileRaw(p)
    const next = data.records.filter((r) => keyString(r) !== target)
    if (next.length === data.records.length) return false
    writeFileRaw(p, { records: next })
    return true
  })
}

/** Test hygiene: wipe the ledger file at the current path (no-op if absent). */
export async function _resetLedgerForTests(): Promise<void> {
  const p = getLedgerPath()
  await withLock(p, () => {
    try {
      fs.rmSync(p, { force: true })
    } catch {}
  })
}
