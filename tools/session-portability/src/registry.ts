// Adapter registry. S1-S6 register their adapters here; the orchestrator (S8) and
// TUI (S9-S11) look them up by harness + direction.

import type { HarnessId } from "./ir"
import type { ImportAdapter, ExportAdapter } from "./adapter"
import { detectHarnesses } from "./detect"

const importAdapters = new Map<HarnessId, ImportAdapter>()
const exportAdapters = new Map<HarnessId, ExportAdapter>()

export function registerImport(adapter: ImportAdapter): void {
  importAdapters.set(adapter.harness, adapter)
}

export function registerExport(adapter: ExportAdapter): void {
  exportAdapters.set(adapter.harness, adapter)
}

export function getImport(harness: HarnessId): ImportAdapter | undefined {
  return importAdapters.get(harness)
}

export function getExport(harness: HarnessId): ExportAdapter | undefined {
  return exportAdapters.get(harness)
}

export function listImport(): ImportAdapter[] {
  return [...importAdapters.values()]
}

export function listExport(): ExportAdapter[] {
  return [...exportAdapters.values()]
}

/**
 * Which harnesses are actually usable on this machine, per direction. Backed by
 * S7's detectHarnesses(); a harness only counts as a usable source/destination
 * when it's also registered here (no adapter -> can't actually import/export it,
 * even if the harness itself is detected on disk).
 */
export async function listInstalled(): Promise<{
  sources: HarnessId[]
  destinations: HarnessId[]
}> {
  const caps = await detectHarnesses()
  return {
    sources: caps.filter((c) => c.canImport && importAdapters.has(c.harness)).map((c) => c.harness),
    destinations: caps.filter((c) => c.canExport && exportAdapters.has(c.harness)).map((c) => c.harness),
  }
}

/** Test/teardown helper — clears both registries. */
export function _resetRegistry(): void {
  importAdapters.clear()
  exportAdapters.clear()
}
