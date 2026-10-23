// S8 — the orchestrator: the engine that wires S1-S6's adapters + S7's detection
// into the runtime pipeline (detect -> import -> preview -> select dest -> export),
// emitting the progress/idempotency event stream the TUI (S9-S11) and the headless
// CLI both consume. Zero TUI dependency by construction — it only imports the
// registry, the adapter contracts, and its own event/ledger siblings.

import type { HarnessId, PortableSession } from "../ir"
import type { ExportAdapter, ImportAdapter } from "../adapter"
import { getExport, getImport, listInstalled } from "../registry"
import { PorterEventEmitter, type PorterEvent } from "./events"
import * as Ledger from "./ledger"
import { yieldToEventLoop } from "./async-utils"
import { createCwdRemapper } from "./worktree"

const DEFAULT_IMPORT_CONCURRENCY = 8

export interface PortOptions {
  /** Import every discovered session (minus the same-harness-as-dest filter, AC9). */
  all?: boolean
  /** Import only these specific sourceSessionIds (bypasses the --all same-harness filter). */
  ids?: string[]
  /** Ignore the ledger and re-export from scratch (fresh destSessionId). */
  force?: boolean
}

export type ExportStatus = "created" | "updated" | "skipped" | "error"

export interface ExportOutcome {
  sourceHarness: HarnessId
  sourceSessionId: string
  destHarness: HarnessId
  status: ExportStatus
  destSessionId?: string
  reason?: string
  error?: string
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function errorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined
}

export interface OrchestratorDeps {
  /**
   * Remap a session's worktree cwd to its parent project in place, so ported
   * conversations — and the TUI Select screen — group under the original repo
   * instead of a Conductor worktree ("nairobi", "banjul", ...). Default: a
   * per-cwd-memoized remapper from core/worktree. Injectable for tests. Disable
   * at runtime with HELLO_SESSIONS_KEEP_WORKTREE_CWD=1.
   */
  remapCwd?: (session: PortableSession) => void
}

export class Orchestrator {
  readonly events = new PorterEventEmitter()
  // One memoized remapper per orchestrator instance: importAll() canonicalizes
  // cwd on entry (so Select groups by real project), and exportSessions() re-runs
  // it as an idempotent safety net for sessions built outside importAll. Sharing
  // the instance means the export pass hits the import pass's cache.
  private readonly remapCwd: (session: PortableSession) => void

  constructor(deps: OrchestratorDeps = {}) {
    this.remapCwd = deps.remapCwd ?? createCwdRemapper()
  }

  /** Harnesses usable as an import source on this machine (S7, gated on registration). */
  async listSources(): Promise<HarnessId[]> {
    return (await listInstalled()).sources
  }

  /** Harnesses usable as an export destination on this machine (S7, gated on registration). */
  async listDestinations(): Promise<HarnessId[]> {
    return (await listInstalled()).destinations
  }

  /** Every idempotency record in the ledger — the TUI uses this to gray out
   *  sessions already ported to the chosen destination. */
  async listExported(): Promise<Ledger.LedgerRecord[]> {
    return Ledger.listRecords()
  }

  /**
   * Drop ledger records whose destination conversation no longer exists.
   * `liveDestIds` is the set of native session ids currently present in `dest`
   * (the TUI passes the destination's freshly-scanned ids). A record for `dest`
   * whose `destSessionId` is absent means the user deleted that conversation in
   * the destination harness — pruning it makes the row stop showing as "already
   * imported" AND lets a re-port re-create it instead of hitting the ledger's
   * skip path (exportSessions treats a present record as "already exported").
   * Returns the number of records pruned.
   */
  async reconcileLedger(dest: HarnessId, liveDestIds: ReadonlySet<string>): Promise<number> {
    const records = await Ledger.listRecords()
    let pruned = 0
    for (const record of records) {
      if (record.destHarness !== dest) continue
      if (liveDestIds.has(record.destSessionId)) continue
      if (await Ledger.removeRecord(record)) pruned++
    }
    return pruned
  }

  private requireImport(harness: HarnessId): ImportAdapter {
    const adapter = getImport(harness)
    if (!adapter) throw new Error(`orchestrator: no import adapter registered for "${harness}"`)
    return adapter
  }

  private requireExport(harness: HarnessId): ExportAdapter {
    const adapter = getExport(harness)
    if (!adapter) throw new Error(`orchestrator: no export adapter registered for "${harness}"`)
    return adapter
  }

  /**
   * Discover + parse every session for one harness into the Hub IR. Concurrency
   * is capped (I/O-bound, no shared mutable state) so large session stores don't
   * open hundreds of file handles at once. A single session's parse failure emits
   * `error` and is dropped from the result — it never aborts the batch.
   */
  async importAll(harness: HarnessId, opts?: { concurrency?: number }): Promise<PortableSession[]> {
    const adapter = this.requireImport(harness)
    const refs = await adapter.discover()
    const total = refs.length
    this.events.emit({ type: "import:start", harness, total })

    const results: Array<PortableSession | undefined> = new Array(refs.length)
    const concurrency = Math.max(1, Math.min(opts?.concurrency ?? DEFAULT_IMPORT_CONCURRENCY, Math.max(refs.length, 1)))
    let nextIndex = 0
    let completed = 0

    const worker = async (): Promise<void> => {
      while (true) {
        const i = nextIndex++
        if (i >= refs.length) return
        const ref = refs[i]!
        try {
          const session = await adapter.parse(ref)
          // Canonicalize worktree cwd on entry so every downstream consumer —
          // the TUI Select grouping, project counts, and export — sees the real
          // project, not a Conductor worktree. Best-effort; never throws.
          this.remapCwd(session)
          results[i] = session
        } catch (err) {
          this.events.emit({
            type: "error",
            harness,
            sourceSessionId: ref.sourceSessionId,
            message: errorMessage(err),
            stack: errorStack(err),
          })
        } finally {
          completed++
          this.events.emit({
            type: "import:progress",
            harness,
            sourceSessionId: ref.sourceSessionId,
            current: completed,
            total,
          })
        }
        // See src/core/async-utils.ts: adapter.parse() is a synchronous file
        // read wrapped in an async function, so the `await` above resolves
        // via a microtask, not real I/O — a real yield here is what lets a
        // caller's render loop (and this event stream) actually paint
        // between sessions instead of freezing for the whole batch.
        await yieldToEventLoop()
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    this.events.emit({ type: "import:done", harness, current: completed, total })
    return results.filter((s): s is PortableSession => s !== undefined)
  }

  /**
   * Export a batch of Hub IR sessions into one destination harness. Consults
   * ONLY S8's ledger (src/core/ledger.ts) — adapters have no idempotency state of
   * their own. Reconciliation per session:
   *   - no ledger record            -> create (write with no opts).
   *   - record, revision unchanged  -> skip, unless `force`.
   *   - record, revision unchanged, `force` -> recreate from scratch (write with force:true).
   *   - record, revision grew (sourceChanged) -> update in place
   *     (write with existingDestId: record.destSessionId).
   * Per-session failures are isolated: one bad session emits `error` and does not
   * abort the batch.
   */
  async exportSessions(
    dest: HarnessId,
    sessions: PortableSession[],
    opts?: { force?: boolean },
  ): Promise<ExportOutcome[]> {
    const adapter = this.requireExport(dest)
    const total = sessions.length
    this.events.emit({ type: "export:start", harness: dest, total })

    const outcomes: ExportOutcome[] = []
    let completed = 0

    for (const session of sessions) {
      // Hub-level worktree->parent remap: rewrites session.cwd once, before any
      // adapter sees it, so all three destinations file the conversation under the
      // real repo. Best-effort and does not touch the ledger key (which is keyed
      // on sourceSessionId, never cwd).
      this.remapCwd(session)

      const key = { sourceHarness: session.sourceHarness, sourceSessionId: session.sourceSessionId, destHarness: dest }
      const revision = session.turns.length

      try {
        const existing = await Ledger.getRecord(key)
        const sourceChanged = existing !== undefined && existing.sourceRevision !== revision

        if (existing && !sourceChanged && !opts?.force) {
          outcomes.push({
            ...key,
            status: "skipped",
            destSessionId: existing.destSessionId,
            reason: "already exported (ledger hit); pass force to re-export",
          })
          completed++
          this.events.emit({
            type: "export:progress",
            harness: dest,
            sourceSessionId: session.sourceSessionId,
            current: completed,
            total,
            message: "skipped (duplicate)",
          })
          continue
        }

        const writeOpts = opts?.force ? { force: true } : sourceChanged && existing ? { existingDestId: existing.destSessionId } : {}
        const result = await adapter.write(session, writeOpts)

        await Ledger.upsertRecord({
          ...key,
          destSessionId: result.destSessionId,
          sourceRevision: revision,
          exportedAt: Date.now(),
        })

        outcomes.push({
          ...key,
          status: sourceChanged && !opts?.force ? "updated" : "created",
          destSessionId: result.destSessionId,
        })
        completed++
        this.events.emit({
          type: "export:progress",
          harness: dest,
          sourceSessionId: session.sourceSessionId,
          current: completed,
          total,
        })
      } catch (err) {
        const message = errorMessage(err)
        completed++
        this.events.emit({
          type: "error",
          harness: dest,
          sourceSessionId: session.sourceSessionId,
          message,
          stack: errorStack(err),
        })
        outcomes.push({ ...key, status: "error", error: message })
        this.events.emit({
          type: "export:progress",
          harness: dest,
          sourceSessionId: session.sourceSessionId,
          current: completed,
          total,
          message: "error",
        })
      }
      // See src/core/async-utils.ts: Ledger.getRecord/upsertRecord and
      // adapter.write() are synchronous disk I/O wrapped in async functions,
      // so every `await` above resolves via a microtask, never a real I/O
      // wait — a batch of these chains back-to-back starves the host's
      // render loop for the whole export instead of just this session.
      await yieldToEventLoop()
    }

    this.events.emit({ type: "export:done", harness: dest, current: completed, total })
    return outcomes
  }

  /**
   * Convenience import -> export in one call.
   *
   * `--all` semantics (AC9): filters out sessions whose `sourceHarness` equals the
   * destination harness — porting FROM a harness back INTO itself is never
   * included in a blanket `--all`; only an explicit `--id` can target that. This
   * does not solve cross-harness clone chains (A->B->A) — documented v1 limitation.
   */
  async port(source: HarnessId, dest: HarnessId, opts?: PortOptions): Promise<ExportOutcome[]> {
    let sessions = await this.importAll(source)

    if (opts?.ids && opts.ids.length > 0) {
      const idSet = new Set(opts.ids)
      sessions = sessions.filter((s) => idSet.has(s.sourceSessionId))
    } else if (opts?.all) {
      sessions = sessions.filter((s) => s.sourceHarness !== dest)
    }

    return this.exportSessions(dest, sessions, { force: opts?.force })
  }
}

export type { PorterEvent }
