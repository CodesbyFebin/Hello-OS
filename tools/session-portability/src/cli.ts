#!/usr/bin/env bun
// hello-sessions CLI entry (S8, `verify` added in S12, `tui` wired to
// src/tui/app.tsx, composing the S9-S11 screens). `import`/`export`
// subcommands were deliberately dropped in the S8 revision —
// there is no coherent way to pass in-memory Hub IR between separate CLI
// invocations, and nothing downstream needs a standalone import-only/export-only
// headless step (see docs/specs/S8.md).

import fs from "fs"
import os from "os"
import path from "path"

import pkg from "../package.json" with { type: "json" }
import { HarnessId, type PortableSession } from "./ir"
import { detectHarnesses } from "./detect"
import { registerAllAdapters } from "./adapters/index"
import { Orchestrator } from "./core/orchestrator"
import type { PorterEvent } from "./core/events"
import * as Ledger from "./core/ledger"
import { createRunLogger, summarizeOutcomes } from "./core/log"
import { setProjectsRoot, encodeCwd } from "./adapters/claude-code/export"
import { claudeCodeImport } from "./adapters/claude-code/import"
import { configureCodexExport, resetCodexExportConfig } from "./adapters/codex/export"
import { codexImport } from "./adapters/codex/import"
import { opencodeImport } from "./adapters/opencode/import"

function help(): string {
  return [
    `hello-sessions ${pkg.version}`,
    "",
    "Usage: hello-sessions <command>",
    "",
    "Commands:",
    "  detect   Show which harnesses are installed + usable as source/dest",
    "  port     Port sessions from one harness to another",
    "           --from <harness> --to <harness> (--all | --id <sid>...) [--force] [--json]",
    "  verify   Round-trip real sessions end-to-end against isolated temp targets",
    "           [--from <harness>] [--to <harness>[,<harness>...]] [--sample N|--all]",
    "  tui      Launch the interactive porter UI",
  ].join("\n")
}

// --- `port` arg parsing -------------------------------------------------------

interface PortArgs {
  from?: HarnessId
  to?: HarnessId
  all: boolean
  ids: string[]
  force: boolean
  json: boolean
  error?: string
}

function parsePortArgs(rest: string[]): PortArgs {
  let fromRaw: string | undefined
  let toRaw: string | undefined
  let all = false
  const ids: string[] = []
  let force = false
  let json = false

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    switch (arg) {
      case "--from":
        fromRaw = rest[++i]
        break
      case "--to":
        toRaw = rest[++i]
        break
      case "--all":
        all = true
        break
      case "--id":
        ids.push(rest[++i] ?? "")
        break
      case "--force":
        force = true
        break
      case "--json":
        json = true
        break
      default:
        return { all, ids, force, json, error: `Unknown option: ${arg}` }
    }
  }

  if (!fromRaw || !toRaw) return { all, ids, force, json, error: "--from and --to are required" }

  const from = HarnessId.safeParse(fromRaw)
  if (!from.success) return { all, ids, force, json, error: `Unknown harness for --from: ${fromRaw}` }
  const to = HarnessId.safeParse(toRaw)
  if (!to.success) return { all, ids, force, json, error: `Unknown harness for --to: ${toRaw}` }

  if (!all && ids.length === 0) {
    return { all, ids, force, json, error: "one of --all or --id <sid> is required" }
  }

  return { from: from.data, to: to.data, all, ids, force, json }
}

function formatEvent(e: PorterEvent): string {
  const parts: string[] = [e.type, e.harness]
  if (e.sourceSessionId) parts.push(e.sourceSessionId)
  if (e.current !== undefined && e.total !== undefined) parts.push(`${e.current}/${e.total}`)
  if (e.message) parts.push(e.message)
  return parts.join(" ")
}

async function runPort(rest: string[]): Promise<number> {
  const parsed = parsePortArgs(rest)
  if (parsed.error || !parsed.from || !parsed.to) {
    console.error(parsed.error ?? "invalid arguments")
    console.error("Usage: hello-sessions port --from <harness> --to <harness> (--all | --id <sid>...) [--force] [--json]")
    return 2
  }

  registerAllAdapters()
  // Real, user-initiated port: allow the opencode export to open/focus the
  // imported project in the desktop app (opt-in; off everywhere else so tests /
  // verify / library callers never launch the GUI).
  process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
  const orchestrator = new Orchestrator()

  if (parsed.json) {
    orchestrator.events.on((e) => console.log(JSON.stringify(e)))
  } else {
    orchestrator.events.on((e) => console.error(formatEvent(e)))
  }

  const logger = createRunLogger(() => new Date().toISOString())
  logger.attach(orchestrator.events)
  const startedAt = Date.now()

  const outcomes = await orchestrator.port(parsed.from, parsed.to, {
    all: parsed.all,
    ids: parsed.ids,
    force: parsed.force,
  })

  logger.finishRun({
    from: parsed.from,
    to: parsed.to,
    options: { all: !!parsed.all, ids: parsed.ids?.length ?? 0, force: !!parsed.force },
    ...summarizeOutcomes(outcomes),
    durationMs: Date.now() - startedAt,
    cliVersion: pkg.version,
  })

  if (!parsed.json) {
    for (const o of outcomes) {
      const dest = o.destSessionId ? ` (${o.destSessionId})` : ""
      console.log(`${o.sourceSessionId} -> ${o.status}${dest}${o.reason ? ` — ${o.reason}` : ""}${o.error ? ` — ${o.error}` : ""}`)
    }
  }

  return outcomes.some((o) => o.status === "error") ? 1 : 0
}

// --- `verify` (S12): round-trip real sessions end-to-end against isolated ---
// temp targets. Isolation is mandatory and unconditional — this command NEVER
// writes to a real ~/.claude/projects, ~/.codex/sessions, or the real opencode
// DB, regardless of ambient env vars, by always redirecting every export
// destination at a fresh mktemp root for the lifetime of the process.

interface VerifyArgs {
  from: HarnessId
  to: HarnessId[]
  sample: number
  all: boolean
  error?: string
}

const DEFAULT_VERIFY_SAMPLE = 10
const ALL_HARNESSES: HarnessId[] = ["claude-code", "codex", "opencode"]

function parseVerifyArgs(rest: string[]): VerifyArgs {
  let from: HarnessId = "claude-code"
  let to: HarnessId[] = [...ALL_HARNESSES]
  let sample = DEFAULT_VERIFY_SAMPLE
  let all = false

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    switch (arg) {
      case "--from": {
        const raw = rest[++i]
        const parsed = HarnessId.safeParse(raw)
        if (!parsed.success) return { from, to, sample, all, error: `Unknown harness for --from: ${raw}` }
        from = parsed.data
        break
      }
      case "--to": {
        const raw = rest[++i] ?? ""
        const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
        const parsedList: HarnessId[] = []
        for (const p of parts) {
          const r = HarnessId.safeParse(p)
          if (!r.success) return { from, to, sample, all, error: `Unknown harness for --to: ${p}` }
          parsedList.push(r.data)
        }
        if (parsedList.length > 0) to = parsedList
        break
      }
      case "--sample": {
        const raw = rest[++i]
        const n = Number(raw)
        if (!Number.isFinite(n) || n <= 0) return { from, to, sample, all, error: `--sample must be a positive integer: ${raw}` }
        sample = Math.floor(n)
        break
      }
      case "--all":
        all = true
        break
      default:
        return { from, to, sample, all, error: `Unknown option: ${arg}` }
    }
  }

  return { from, to, sample, all }
}

/** Newest-N by updatedAt, plus the single largest (by turn count) if not already included. */
function pickSample(sessions: PortableSession[], n: number): PortableSession[] {
  const byNewest = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  const picked = byNewest.slice(0, n)
  const largest = [...sessions].sort((a, b) => b.turns.length - a.turns.length)[0]
  if (largest && !picked.some((s) => s.sourceSessionId === largest.sourceSessionId)) picked.push(largest)
  return picked
}

interface VerifyFailure {
  sourceHarness: HarnessId
  sourceSessionId: string
  destHarness: HarnessId
  path?: string
  reason: string
}

/**
 * Re-import a just-exported session straight from its destination store,
 * bypassing `discover()` for claude-code (whose discovery walks the real
 * `os.homedir()`-based projects root with no override — S12 finding) by
 * computing the exact synthesized path instead. codex is redirected via a
 * scoped CODEX_HOME flip (parse() itself takes an explicit path and never
 * reads CODEX_HOME); opencode's OPENCODE_DB is already isolated for the whole
 * run, so its own discover() is safe to use directly.
 */
async function reimportFromDest(
  dest: HarnessId,
  destSessionId: string,
  source: PortableSession,
  isolated: { claudeRoot: string; codexHome: string },
): Promise<PortableSession> {
  if (dest === "claude-code") {
    const filePath = path.join(isolated.claudeRoot, encodeCwd(source.cwd), `${destSessionId}.jsonl`)
    return claudeCodeImport.parse({ harness: "claude-code", sourceSessionId: destSessionId, sourcePath: filePath, title: "" })
  }

  if (dest === "codex") {
    const saved = process.env.CODEX_HOME
    process.env.CODEX_HOME = isolated.codexHome
    try {
      const refs = await codexImport.discover()
      const ref = refs.find((r) => r.sourceSessionId === destSessionId)
      if (!ref) throw new Error(`verify: could not locate the exported codex rollout for ${destSessionId}`)
      return await codexImport.parse(ref)
    } finally {
      if (saved === undefined) delete process.env.CODEX_HOME
      else process.env.CODEX_HOME = saved
    }
  }

  const refs = await opencodeImport.discover()
  const ref = refs.find((r) => r.sourceSessionId === destSessionId)
  if (!ref) throw new Error(`verify: could not locate the exported opencode session for ${destSessionId}`)
  return await opencodeImport.parse(ref)
}

/**
 * Fidelity gate (HUB-IR + AC8): turn count, per-turn role+text, monotonic
 * timestamps always; title equality for claude-code/opencode legs only —
 * codex's export doesn't serialize `session.title` (S12 AC8, known v1 gap).
 */
function checkFidelity(dest: HarnessId, source: PortableSession, reimported: PortableSession): string | undefined {
  if (reimported.turns.length !== source.turns.length) {
    return `turn count mismatch: source=${source.turns.length} reimported=${reimported.turns.length}`
  }
  for (let i = 0; i < source.turns.length; i++) {
    if (reimported.turns[i]!.role !== source.turns[i]!.role) return `turn ${i}: role mismatch`
    if (reimported.turns[i]!.text !== source.turns[i]!.text) return `turn ${i}: text mismatch`
  }
  if (dest !== "codex" && reimported.title !== source.title) {
    return `title mismatch: source=${JSON.stringify(source.title)} reimported=${JSON.stringify(reimported.title)}`
  }
  const timestamps = reimported.turns.map((t) => t.timestamp).filter((t): t is number => typeof t === "number")
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i]! < timestamps[i - 1]!) return `timestamps not monotonic at turn ${i}`
  }
  return undefined
}

async function runVerify(rest: string[]): Promise<number> {
  const parsed = parseVerifyArgs(rest)
  if (parsed.error) {
    console.error(parsed.error)
    console.error("Usage: hello-sessions verify [--from <harness>] [--to <harness>[,<harness>...]] [--sample N|--all]")
    return 2
  }

  if (parsed.to.includes("opencode") && parsed.from === "opencode") {
    console.error(
      "verify: opencode cannot be both --from and --to in the same run (OPENCODE_DB would have to point at the real store and an isolated temp store at once). Drop opencode from --to, or change --from.",
    )
    return 2
  }

  registerAllAdapters()

  // --- unconditional isolation: fresh mktemp targets for every destination ---
  // Test hook: SESSION_PORTER_VERIFY_ROOT pins the root across invocations (and
  // skips its removal) so idempotency can be exercised across two SEPARATE CLI
  // processes, the same way it naturally is across two in-process calls.
  // Never set in normal use — an ordinary `verify` run always gets a fresh,
  // disposable root and is torn down at the end of this function.
  const pinnedRoot = process.env.SESSION_PORTER_VERIFY_ROOT
  const root = pinnedRoot ? pinnedRoot : fs.mkdtempSync(path.join(os.tmpdir(), "hello-sessions-verify-"))
  const claudeRoot = path.join(root, "claude-projects")
  const codexHome = path.join(root, "codex-home")
  fs.mkdirSync(claudeRoot, { recursive: true })
  fs.mkdirSync(path.join(codexHome, "sessions"), { recursive: true })
  setProjectsRoot(claudeRoot)
  configureCodexExport({ codexHome })

  const wantsOpencodeDest = parsed.to.includes("opencode")
  const prevOpencodeDb = process.env.OPENCODE_DB
  const prevDisableChannel = process.env.OPENCODE_DISABLE_CHANNEL_DB
  if (wantsOpencodeDest) {
    process.env.OPENCODE_DB = path.join(root, "opencode.db")
    process.env.OPENCODE_DISABLE_CHANNEL_DB = "1"
  }
  Ledger.setLedgerPath(path.join(root, "ledger.json"))

  const cleanup = () => {
    setProjectsRoot(undefined)
    resetCodexExportConfig()
    if (wantsOpencodeDest) {
      if (prevOpencodeDb === undefined) delete process.env.OPENCODE_DB
      else process.env.OPENCODE_DB = prevOpencodeDb
      if (prevDisableChannel === undefined) delete process.env.OPENCODE_DISABLE_CHANNEL_DB
      else process.env.OPENCODE_DISABLE_CHANNEL_DB = prevDisableChannel
    }
    Ledger.setLedgerPath(undefined)
    if (!pinnedRoot) {
      try {
        fs.rmSync(root, { recursive: true, force: true })
      } catch {}
    }
  }

  try {
    const orchestrator = new Orchestrator()

    let sessions: PortableSession[]
    try {
      sessions = await orchestrator.importAll(parsed.from)
    } catch (err) {
      console.error(`verify: failed to import from ${parsed.from}: ${err instanceof Error ? err.message : String(err)}`)
      return 1
    }

    if (sessions.length === 0) {
      console.log(JSON.stringify({ from: parsed.from, sampled: 0, note: `no ${parsed.from} sessions found on this machine`, failures: [] }, null, 2))
      return 0
    }

    const sample = parsed.all ? sessions : pickSample(sessions, parsed.sample)
    const failures: VerifyFailure[] = []
    const perDestination: Record<
      string,
      { created: number; updated: number; skipped: number; error: number; fidelityFailed: number }
    > = {}

    for (const dest of parsed.to) {
      perDestination[dest] = { created: 0, updated: 0, skipped: 0, error: 0, fidelityFailed: 0 }
      const outcomes = await orchestrator.exportSessions(dest, sample)

      for (const outcome of outcomes) {
        if (outcome.status === "error") {
          perDestination[dest]!.error++
          const failedSource = sample.find((s) => s.sourceSessionId === outcome.sourceSessionId)
          failures.push({
            sourceHarness: outcome.sourceHarness,
            sourceSessionId: outcome.sourceSessionId,
            destHarness: dest,
            path: failedSource?.sourcePath,
            reason: outcome.error ?? "export failed",
          })
          continue
        }

        perDestination[dest]![outcome.status]++
        if (outcome.status === "skipped") continue

        const source = sample.find((s) => s.sourceSessionId === outcome.sourceSessionId)!
        try {
          const reimported = await reimportFromDest(dest, outcome.destSessionId!, source, { claudeRoot, codexHome })
          const reason = checkFidelity(dest, source, reimported)
          if (reason) {
            perDestination[dest]!.fidelityFailed++
            failures.push({ sourceHarness: source.sourceHarness, sourceSessionId: source.sourceSessionId, destHarness: dest, path: source.sourcePath, reason })
          }
        } catch (err) {
          perDestination[dest]!.fidelityFailed++
          failures.push({
            sourceHarness: source.sourceHarness,
            sourceSessionId: source.sourceSessionId,
            destHarness: dest,
            path: source.sourcePath,
            reason: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    const report = { from: parsed.from, to: parsed.to, sampled: sample.length, perDestination, failures }
    console.log(JSON.stringify(report, null, 2))
    for (const f of failures) {
      console.error(`FAIL ${f.sourceHarness}/${f.sourceSessionId} -> ${f.destHarness}: ${f.reason}${f.path ? ` (source: ${f.path})` : ""}`)
    }

    return failures.length > 0 ? 1 : 0
  } finally {
    cleanup()
  }
}

async function runDetect(): Promise<number> {
  registerAllAdapters()
  const caps = await detectHarnesses()
  console.log(JSON.stringify(caps, null, 2))
  return 0
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv

  if (cmd === "--version" || cmd === "-v") {
    console.log(pkg.version)
    return 0
  }

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(help())
    return 0
  }

  switch (cmd) {
    case "detect":
      return runDetect()
    case "port":
      return runPort(rest)
    case "verify":
      return runVerify(rest)
    case "tui": {
      const { runTui } = await import("./tui/app")
      return runTui()
    }
    default:
      console.error(`Unknown command: ${cmd}. Run \`hello-sessions --help\`.`)
      return 1
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    createRunLogger(() => new Date().toISOString()).logCrash(err)
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  },
)
