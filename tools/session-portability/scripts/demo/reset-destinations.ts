// Clear the REAL codex + opencode conversation stores for a clean demo slate.
//
// Distinct from `sandbox:clear` (which only touches ~/.hello-sessions-sandbox): this
// wipes the actual installed stores. It ALWAYS snapshots to a timestamped backup
// first (skip with --no-backup), and refuses to edit opencode state while the
// desktop app is running (it rewrites its state on quit and would undo us).
//
//   bun run demo:reset                 # codex + opencode conversations
//   bun run demo:reset --projects      # also clear opencode's "Recent projects" list
//   bun run demo:reset --ledger        # also nuke the porter ledger
//   bun run demo:reset --harness codex # one harness only
//   bun run demo:reset --no-backup
//
// What "clear" means per store:
//   codex    -> delete ~/.codex/sessions/**/rollout-*.jsonl (keeps codex state)
//   opencode -> empty the session-scoped tables in the installed opencode.db,
//               then scrub the desktop app-state (JSON pointers + web-storage
//               route) so it doesn't reopen a deleted session and 404.
//               With --projects, also empties project/project_directory (the
//               desktop home screen's "Recent projects" list).
//
// Crucially it ALSO drops the porter ledger records whose destHarness is a
// cleared store — otherwise the TUI keeps greying those sources as "already
// imported" against a now-empty destination. (--keep-ledger opts out; --ledger
// nukes the whole ledger file.)

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Database } from "bun:sqlite"

import { harnessStore, type HarnessId } from "../sandbox/config"
import { parseHarnessArg } from "../sandbox/lib"
import { runBackup } from "../sandbox/backup"
import { isOpencodeAppRunning, reconcileOpencodeAppState } from "../sandbox/opencode-appstate"

/** ledger.json path — matches src/core/data-dir + core/ledger resolution. */
export function ledgerPath(): string {
  if (process.env.HELLO_SESSIONS_LEDGER_PATH) return process.env.HELLO_SESSIONS_LEDGER_PATH
  const dataDir = process.env.XDG_DATA_HOME
    ? path.join(process.env.XDG_DATA_HOME, "hello-sessions")
    : path.join(os.homedir(), ".local", "share", "hello-sessions")
  return path.join(dataDir, "ledger.json")
}

/** Drop every ledger record whose destHarness is in `dests`. Returns count removed. */
export function pruneLedgerForDests(dests: Set<HarnessId>): number {
  const p = ledgerPath()
  if (!fs.existsSync(p)) return 0
  let parsed: { records?: Array<{ destHarness: HarnessId }> }
  try {
    parsed = JSON.parse(fs.readFileSync(p, "utf8"))
  } catch {
    return 0
  }
  const records = Array.isArray(parsed.records) ? parsed.records : []
  const kept = records.filter((r) => !dests.has(r.destHarness))
  const removed = records.length - kept.length
  if (removed > 0) fs.writeFileSync(p, JSON.stringify({ records: kept }, null, 2))
  return removed
}

/** Delete every `rollout-*.jsonl` under ~/.codex/sessions; keep codex internals. */
function clearCodex(): number {
  const dir = harnessStore("codex").real[0]!
  if (!fs.existsSync(dir)) return 0
  const rollouts = fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((e) => /rollout-.*\.jsonl$/.test(e))
  for (const rel of rollouts) fs.rmSync(path.join(dir, rel), { force: true })
  return rollouts.length
}

// Session-scoped tables in the opencode V1 schema. Children (FK holders) first;
// project/workspace/auth tables are intentionally left intact.
const OPENCODE_SESSION_TABLES = [
  "part",
  "message",
  "session_message",
  "todo",
  "session_input",
  "session_context_epoch",
  "session_share",
  "session",
]

// The desktop home screen's "Recent projects" list is the `project` table
// (ordered by time_updated). Children first so we don't rely on FK-cascade
// being enabled in bun:sqlite. Sessions are already gone by the time this runs.
const OPENCODE_PROJECT_TABLES = ["project_directory", "project"]

/** Empty opencode conversation tables in the installed opencode.db. */
function clearOpencodeDb(): number {
  const dbPath = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db")
  if (!fs.existsSync(dbPath)) return 0
  const db = new Database(dbPath)
  try {
    const before = (db.query("SELECT count(*) AS n FROM session").get() as { n: number }).n
    db.exec("BEGIN")
    for (const t of OPENCODE_SESSION_TABLES) {
      try {
        db.exec(`DELETE FROM ${t}`)
      } catch {
        // table may not exist in older/newer schemas — skip, don't abort.
      }
    }
    db.exec("COMMIT")
    db.exec("VACUUM")
    return before
  } finally {
    db.close()
  }
}

/** Empty opencode's "Recent projects" list (project + project_directory). Returns count removed. */
function clearOpencodeProjects(): number {
  const dbPath = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db")
  if (!fs.existsSync(dbPath)) return 0
  const db = new Database(dbPath)
  try {
    const before = (db.query("SELECT count(*) AS n FROM project").get() as { n: number }).n
    db.exec("BEGIN")
    for (const t of OPENCODE_PROJECT_TABLES) {
      try {
        db.exec(`DELETE FROM ${t}`)
      } catch {
        // table may not exist in older/newer schemas — skip, don't abort.
      }
    }
    db.exec("COMMIT")
    db.exec("VACUUM")
    return before
  } finally {
    db.close()
  }
}

function main(): void {
  const argv = Bun.argv.slice(2)
  const harnesses = parseHarnessArg(argv).filter((h): h is "codex" | "opencode" => h === "codex" || h === "opencode")
  const backup = !argv.includes("--no-backup")
  const nukeLedger = argv.includes("--ledger")
  const keepLedger = argv.includes("--keep-ledger")
  const clearProjects = argv.includes("--projects")

  if (harnesses.length === 0) {
    console.error("nothing to clear: pass --harness codex|opencode|all")
    process.exit(1)
  }

  // Guard opencode's desktop app up front so we don't half-clear then bail.
  if (harnesses.includes("opencode") && isOpencodeAppRunning()) {
    console.error("OpenCode desktop app is running — quit it (Cmd+Q) first, then re-run.")
    process.exit(1)
  }

  if (backup) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-")
    const dirs = runBackup(harnesses, ts)
    console.log(`backed up to:\n${dirs.join("\n")}`)
  }

  for (const h of harnesses) {
    if (h === "codex") {
      console.log(`codex: deleted ${clearCodex()} rollout file(s)`)
    } else {
      const cleared = clearOpencodeDb()
      const projects = clearProjects ? clearOpencodeProjects() : 0
      const r = reconcileOpencodeAppState({ resetWebStorage: true })
      console.log(
        `opencode: cleared ${cleared} session(s)${clearProjects ? ` + ${projects} recent project(s)` : ""}; scrubbed ${r.edited.length} app-state file(s) + reset ${r.webStorageReset.length} web-storage dir(s)`,
      )
    }
  }

  if (nukeLedger) {
    fs.rmSync(ledgerPath(), { force: true })
    console.log(`nuked ledger: ${ledgerPath()}`)
  } else if (!keepLedger) {
    // Default: drop ledger records pointing at the destinations we just cleared,
    // so those sources stop showing as "already imported" against an empty store.
    const removed = pruneLedgerForDests(new Set(harnesses))
    console.log(`ledger: pruned ${removed} record(s) for cleared destination(s) [${harnesses.join(", ")}]`)
  }
}

if (import.meta.main) main()
