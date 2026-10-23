import { test, expect, afterEach } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseHarnessArg, copyDir } from "../../scripts/sandbox/lib"

const made: string[] = []
afterEach(() => {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

test("parseHarnessArg expands 'all'", () => {
  expect(parseHarnessArg(["--harness", "all"])).toEqual(["claude-code", "codex", "opencode"])
})

test("parseHarnessArg defaults to all when flag absent", () => {
  expect(parseHarnessArg([])).toEqual(["claude-code", "codex", "opencode"])
})

test("parseHarnessArg selects one", () => {
  expect(parseHarnessArg(["--harness", "codex"])).toEqual(["codex"])
})

test("parseHarnessArg rejects unknown harness", () => {
  expect(() => parseHarnessArg(["--harness", "cursor"])).toThrow("unknown harness")
})

test("copyDir copies a tree", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cp-"))
  made.push(root)
  fs.mkdirSync(path.join(root, "a", "nested"), { recursive: true })
  fs.writeFileSync(path.join(root, "a", "f.txt"), "hi")
  fs.writeFileSync(path.join(root, "a", "nested", "g.txt"), "deep")
  copyDir(path.join(root, "a"), path.join(root, "b"))
  expect(fs.readFileSync(path.join(root, "b", "f.txt"), "utf8")).toBe("hi")
  expect(fs.readFileSync(path.join(root, "b", "nested", "g.txt"), "utf8")).toBe("deep")
})

test("copyDir is a no-op for a missing source", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cp-"))
  made.push(root)
  copyDir(path.join(root, "missing"), path.join(root, "out"))
  expect(fs.existsSync(path.join(root, "out"))).toBe(false)
})
