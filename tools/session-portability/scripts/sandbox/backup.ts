import fs from "node:fs"
import path from "node:path"
import { harnessStore, type HarnessId } from "./config"
import { parseHarnessArg, copyDir, backupsRoot } from "./lib"

export function runBackup(harnesses: HarnessId[], timestamp: string): string[] {
  const dirs: string[] = []
  for (const h of harnesses) {
    const dest = path.join(backupsRoot(h), timestamp)
    fs.mkdirSync(dest, { recursive: true })
    harnessStore(h).real.forEach((src, i) => copyDir(src, path.join(dest, `store-${i}`)))
    dirs.push(dest)
  }
  return dirs
}

if (import.meta.main) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  const dirs = runBackup(parseHarnessArg(Bun.argv.slice(2)), ts)
  console.log(dirs.join("\n"))
}
