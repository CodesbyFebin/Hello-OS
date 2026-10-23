import { test, expect, beforeAll, afterAll } from "bun:test"
import { rerouteLines } from "../../scripts/sandbox/reroute"

let prevSandbox: string | undefined

beforeAll(() => {
  prevSandbox = process.env.HELLO_SESSIONS_SANDBOX_ROOT
  process.env.HELLO_SESSIONS_SANDBOX_ROOT = "/tmp/omsb"
})

afterAll(() => {
  if (prevSandbox === undefined) delete process.env.HELLO_SESSIONS_SANDBOX_ROOT
  else process.env.HELLO_SESSIONS_SANDBOX_ROOT = prevSandbox
})

test("write mode emits CLI env for codex plus ledger isolation", () => {
  const lines = rerouteLines(["codex"], "write")
  expect(lines).toContain("export CODEX_HOME=/tmp/omsb/codex")
  expect(lines).toContain("export HELLO_SESSIONS_LEDGER_PATH=/tmp/omsb/ledger.json")
})

test("write mode emits claude projects root + import ledger dir", () => {
  const lines = rerouteLines(["claude-code"], "write")
  expect(lines).toContain("export CLAUDE_PROJECTS_ROOT=/tmp/omsb/claude-code/projects")
  expect(lines).toContain("export CLAUDE_IMPORT_LEDGER_DIR=/tmp/omsb/claude-code")
})

test("write mode emits opencode db + channel-db kill switch", () => {
  const lines = rerouteLines(["opencode"], "write")
  expect(lines).toContain("export OPENCODE_DB=/tmp/omsb/opencode/opencode.db")
  expect(lines).toContain("export OPENCODE_DISABLE_CHANNEL_DB=1")
})

test("app mode emits desktop read env for opencode, no ledger", () => {
  const lines = rerouteLines(["opencode"], "app")
  expect(lines).toContain("export XDG_DATA_HOME=/tmp/omsb")
  expect(lines.some((l) => l.includes("HELLO_SESSIONS_LEDGER_PATH"))).toBe(false)
})
