// The adapter contract every spoke implements. Import = spoke -> IR. Export = IR -> spoke.
// Adapters are the seam that lets one agent own one import/export per harness.

import type { HarnessId, PortableSession } from "./ir"

export type { HarnessId, PortableSession }

/** A discoverable session in a source harness (before full parse). */
export interface SessionRef {
  harness: HarnessId
  sourceSessionId: string
  sourcePath: string
  title: string
  updatedAt?: number
  /** True if this session was already imported (ledger hit). */
  imported?: boolean
  /** True if the source grew since it was last imported (continuation). */
  sourceChanged?: boolean
}

/** Outcome of writing one session into a destination harness. */
export interface ExportResult {
  destSessionId: string
  skipped: boolean
  reason?: string
}

/** Reads a harness -> Hub IR. */
export interface ImportAdapter {
  harness: HarnessId
  /** Is this harness present / readable on this machine? */
  detect(): Promise<boolean>
  /** Enumerate sessions, newest-first. */
  discover(): Promise<SessionRef[]>
  /** Parse one session into the Hub IR. */
  parse(ref: SessionRef): Promise<PortableSession>
}

/** Options threaded through from S8's orchestrator/ledger into a single write() call. */
export interface WriteOptions {
  /** Re-export from scratch even if a live destination already exists. */
  force?: boolean
  /**
   * Present when S8's ledger has a live record for this (source, dest) pair —
   * attempt to update that destination session in place instead of teardown+recreate.
   * Adapters that can't update in place fall back to creating a fresh destination and
   * returning its (new) id; the orchestrator reconciles the ledger either way.
   */
  existingDestId?: string
}

/**
 * Writes Hub IR -> a harness. Idempotent from the caller's perspective only insofar
 * as the caller (S8's orchestrator) decides whether to call write() at all — adapters
 * no longer own any skip/dedupe logic themselves; a write() call always writes.
 */
export interface ExportAdapter {
  harness: HarnessId
  /** Can we write to this harness here? */
  detect(): Promise<boolean>
  /** Create (or, with opts.existingDestId, update in place) the session in the destination. */
  write(session: PortableSession, opts?: WriteOptions): Promise<ExportResult>
  /** Undo a single import by its source session id. */
  teardown(sourceSessionId: string): Promise<void>
}
