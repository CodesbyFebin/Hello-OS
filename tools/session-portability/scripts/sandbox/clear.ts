import fs from "node:fs"
import path from "node:path"
import { harnessStore, sandboxRoot, type HarnessId } from "./config"
import { parseHarnessArg, rmDir } from "./lib"

// NOTE: sandbox clear is deliberately sandbox-only — it never touches real
// stores or the installed desktop app's state. The desktop app-state scrub
// (opencode-appstate.ts) that keeps the real OpenCode app from reopening a
// deleted session lives in `demo:reset` (scripts/demo/reset-destinations.ts),
// the explicit real-store clearer.
export function runClear(harnesses: HarnessId[]): void {
  for (const h of harnesses) {
    for (const p of harnessStore(h).sandbox) {
      if (!p.startsWith(sandboxRoot())) throw new Error(`refusing to clear non-sandbox path: ${p}`)
      rmDir(p)
    }
  }
  // The sandbox ledger records what was exported into the sandbox stores;
  // keeping it after wiping them leaves dangling idempotency state (port
  // would "skip" against an empty destination). Clear them together.
  fs.rmSync(path.join(sandboxRoot(), "ledger.json"), { force: true })
}

if (import.meta.main) {
  runClear(parseHarnessArg(Bun.argv.slice(2)))
  console.log("cleared")
}
