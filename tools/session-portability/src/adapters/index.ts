// Reconciliation wiring: the one place that imports every adapter and registers
// it. Adapters themselves never touch the registry — this file is what makes the
// S1-S6 fan-out compose. Call registerAllAdapters() once at startup (CLI entry,
// tests that need the full registry).

import { registerImport, registerExport } from "../registry"

import { claudeCodeImport } from "./claude-code/import"
import { claudeCodeExport } from "./claude-code/export"
import { codexImport } from "./codex/import"
import { codexExport } from "./codex/export"
import { opencodeImport } from "./opencode/import"
import { opencodeExport } from "./opencode/export"

/**
 * Idempotent: registerImport/registerExport are Map.set under the hood, so
 * calling this more than once (or after a test's _resetRegistry()) is safe.
 */
export function registerAllAdapters(): void {
  registerImport(claudeCodeImport)
  registerImport(codexImport)
  registerImport(opencodeImport)
  registerExport(claudeCodeExport)
  registerExport(codexExport)
  registerExport(opencodeExport)
}

export {
  claudeCodeImport,
  claudeCodeExport,
  codexImport,
  codexExport,
  opencodeImport,
  opencodeExport,
}
