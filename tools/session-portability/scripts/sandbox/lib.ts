import fs from "node:fs"
import path from "node:path"
import { HARNESSES, type HarnessId, sandboxRoot } from "./config"

export function parseHarnessArg(argv: string[]): HarnessId[] {
  const i = argv.indexOf("--harness")
  const v = i >= 0 ? argv[i + 1] : undefined
  if (!v || v === "all") return [...HARNESSES]
  if (!(HARNESSES as string[]).includes(v)) throw new Error(`unknown harness: ${v}`)
  return [v as HarnessId]
}

export function copyDir(src: string, dst: string): void {
  if (!fs.existsSync(src)) return
  fs.cpSync(src, dst, { recursive: true })
}

export function rmDir(p: string): void {
  fs.rmSync(p, { recursive: true, force: true })
}

export function backupsRoot(h: HarnessId): string {
  return path.join(sandboxRoot(), "backups", h)
}

/** Backup timestamps under backupsRoot(h), newest first (ISO-ish names sort). */
export function listBackups(h: HarnessId): string[] {
  const root = backupsRoot(h)
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root).sort().reverse()
}
