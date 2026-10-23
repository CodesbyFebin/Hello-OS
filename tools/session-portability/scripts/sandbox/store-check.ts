import type { HarnessId } from "./config"
import type { SessionRef } from "../../src/adapter"
import { claudeCodeImport } from "../../src/adapters/claude-code/import"
import { codexImport } from "../../src/adapters/codex/import"
import { opencodeImport } from "../../src/adapters/opencode/import"

const IMPORTERS = {
  "claude-code": claudeCodeImport,
  codex: codexImport,
  opencode: opencodeImport,
} as const

/** Fast deterministic check: does the destination's own discover() see a match? */
export async function sessionExists(
  dest: HarnessId,
  predicate: (s: SessionRef) => boolean,
): Promise<boolean> {
  const refs = await IMPORTERS[dest].discover()
  return refs.some(predicate)
}

export async function listDestSessions(dest: HarnessId): Promise<SessionRef[]> {
  return IMPORTERS[dest].discover()
}
