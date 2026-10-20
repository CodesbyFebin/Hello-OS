import { test, expect, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runSeed } from "../../scripts/sandbox/seed"
import { harnessStore } from "../../scripts/sandbox/config"

let tmp: string
let prevSandbox: string | undefined

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seed-"))
  prevSandbox = process.env.HELLO_SESSIONS_SANDBOX_ROOT
  process.env.HELLO_SESSIONS_SANDBOX_ROOT = path.join(tmp, "sandbox")
})

afterAll(() => {
  if (prevSandbox === undefined) delete process.env.HELLO_SESSIONS_SANDBOX_ROOT
  else process.env.HELLO_SESSIONS_SANDBOX_ROOT = prevSandbox
  fs.rmSync(tmp, { recursive: true, force: true })
})

test("seed copies N convos across M projects into the sandbox", () => {
  const source = path.join(tmp, "src-projects")
  for (const p of ["-proj-a", "-proj-b", "-proj-c", "-proj-d"]) {
    fs.mkdirSync(path.join(source, p), { recursive: true })
    fs.writeFileSync(path.join(source, p, "one.jsonl"), "{}")
    fs.writeFileSync(path.join(source, p, "two.jsonl"), "{}")
  }
  const picked = runSeed({ projects: 3, convos: 5, sourceRoot: source })
  expect(picked.length).toBe(5)
  expect(new Set(picked.map((x) => x.project)).size).toBe(3)
  const sb = harnessStore("claude-code").sandbox[0]!
  for (const p of picked) {
    expect(fs.existsSync(path.join(sb, p.project, path.basename(p.file)))).toBe(true)
  }
})

test("seed skips project dirs with no .jsonl and caps at available convos", () => {
  const source = path.join(tmp, "sparse-projects")
  fs.mkdirSync(path.join(source, "-empty"), { recursive: true })
  fs.mkdirSync(path.join(source, "-full"), { recursive: true })
  fs.writeFileSync(path.join(source, "-full", "a.jsonl"), "{}")
  const picked = runSeed({ projects: 3, convos: 5, sourceRoot: source })
  expect(picked.length).toBe(1)
  expect(picked[0]!.project).toBe("-full")
})
