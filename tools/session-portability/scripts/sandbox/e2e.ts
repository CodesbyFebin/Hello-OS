// Autonomous deep-flow driver: port ONE conversation into the sandbox, then
// prove it landed (store-check) and is resumable (resume-probe). Pure
// reporter — every failure becomes an issues.jsonl entry and the run
// continues; exit code reflects whether any phase failed.
//
// Usage: bun run scripts/sandbox/e2e.ts --from claude-code --to codex --id <sid>
// Assumes backup + seed already ran (the port-sandbox-test skill chains them).

import fs from "node:fs"
import path from "node:path"
import { harnessStore, writeEnv, ledgerEnv, type HarnessId } from "./config"
import { logIssue, type Issue } from "./issues"

interface PhaseResult {
  phase: Issue["phase"]
  ok: boolean
  detail: string
}

function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

export async function runE2E(
  from: HarnessId,
  to: HarnessId,
  sessionId: string,
  opts: { skipResume?: boolean } = {},
): Promise<PhaseResult[]> {
  const results: PhaseResult[] = []
  // Sandbox store dirs must exist before adapters write (sqlite won't create
  // a DB inside a missing directory).
  for (const h of [from, to]) for (const p of harnessStore(h).sandbox) fs.mkdirSync(p, { recursive: true })
  const env = { ...process.env, ...writeEnv(from), ...writeEnv(to), ...ledgerEnv() }
  const report = (phase: Issue["phase"], ok: boolean, detail: string) => {
    results.push({ phase, ok, detail })
    if (!ok) {
      logIssue({
        at: new Date().toISOString(),
        sourceHarness: from,
        destHarness: to,
        sessionId,
        project: "",
        phase,
        message: detail.slice(0, 500),
      })
    }
  }

  // --- port (child process so adapters resolve env fresh) --------------------
  const port = Bun.spawnSync(
    ["bun", "run", "--silent", "cli", "port", "--from", from, "--to", to, "--id", sessionId, "--json"],
    { env, cwd: path.join(import.meta.dir, "..", "..") },
  )
  const portOut = port.stdout.toString() + port.stderr.toString()
  const exported = port.exitCode === 0 && /"type":"export:done"/.test(portOut)
  report("port", exported, exported ? "export:done" : portOut.slice(-500))
  if (!exported) return results

  // --- store-check via the destination's own discover() ----------------------
  // Child bun -e so CODEX_HOME/OPENCODE_DB are read fresh at module load.
  const destId = await (async () => {
    const { getRecord } = await import("../../src/core/ledger")
    process.env.HELLO_SESSIONS_LEDGER_PATH = ledgerEnv().HELLO_SESSIONS_LEDGER_PATH
    const rec = await getRecord({ sourceHarness: from, sourceSessionId: sessionId, destHarness: to })
    return rec?.destSessionId
  })()
  if (!destId) {
    report("store-check", false, "no ledger record after successful export")
    return results
  }
  const check = Bun.spawnSync(
    [
      "bun",
      "-e",
      `const { sessionExists } = await import("${path.join(import.meta.dir, "store-check.ts")}");` +
        `const found = await sessionExists("${to}", (s) => s.sourceSessionId === "${destId}" || (s.sourcePath ?? "").includes("${destId}"));` +
        `console.log(found ? "FOUND" : "NOT-FOUND")`,
    ],
    { env, cwd: path.join(import.meta.dir, "..", "..") },
  )
  const found = check.stdout.toString().includes("FOUND") && !check.stdout.toString().includes("NOT-FOUND")
  report("store-check", found, found ? `destId ${destId} visible via discover()` : check.stdout.toString() + check.stderr.toString())

  // --- resume-probe: the destination harness itself replies ------------------
  if (opts.skipResume) return results
  const { probeResume } = await import("./resume-probe")
  const probe = await probeResume(to, destId, { ...writeEnv(to), ...ledgerEnv() })
  report("resume", probe.ok, probe.ok ? "harness replied ok" : probe.output.slice(-500))

  return results
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2)
  const from = (arg(argv, "--from") ?? "claude-code") as HarnessId
  const to = arg(argv, "--to") as HarnessId
  const id = arg(argv, "--id")
  if (!to || !id) {
    console.error("usage: e2e.ts --from <h> --to <h> --id <sessionId>")
    process.exit(2)
  }
  const results = await runE2E(from, to, id, { skipResume: argv.includes("--skip-resume") })
  console.log(JSON.stringify({ from, to, id, results }, null, 2))
  process.exit(results.every((r) => r.ok) ? 0 : 1)
}
