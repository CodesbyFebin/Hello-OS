// S8 — the orchestrator's progress/idempotency event stream. A typed emitter with
// no TUI dependency: the CLI (--json) and the TUI (S9-S11) are just two listeners
// on the same stream.

import type { HarnessId } from "../ir"

export type PorterEventType =
  | "import:start"
  | "import:progress"
  | "import:done"
  | "export:start"
  | "export:progress"
  | "export:done"
  | "error"

/**
 * One envelope shape for every event. Fields are optional per-type (a "start"
 * event has no sourceSessionId; a "progress" event usually has current/total),
 * kept as a single union member (rather than a per-type discriminated union) so
 * `--json` consumers can treat every line the same way: parse, switch on `type`.
 */
export interface PorterEvent {
  type: PorterEventType
  harness: HarnessId
  sourceSessionId?: string
  current?: number
  total?: number
  message?: string
  /** Error stack trace, `error` events only — retained for the run log, redacted before persistence. */
  stack?: string
}

export type PorterEventListener = (event: PorterEvent) => void

/** A minimal typed pub/sub — no Node EventEmitter dependency, works in any runtime. */
export class PorterEventEmitter {
  private listeners = new Set<PorterEventListener>()

  /** Subscribe; returns an unsubscribe function. */
  on(listener: PorterEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  off(listener: PorterEventListener): void {
    this.listeners.delete(listener)
  }

  emit(event: PorterEvent): void {
    // Snapshot so a listener unsubscribing mid-emit never mutates the set we're iterating.
    for (const listener of [...this.listeners]) listener(event)
  }

  /** Test/diagnostic helper. */
  listenerCount(): number {
    return this.listeners.size
  }
}
