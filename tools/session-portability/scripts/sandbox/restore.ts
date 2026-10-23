import fs from "node:fs"
import path from "node:path"
import { harnessStore, type HarnessId } from "./config"
import { parseHarnessArg, copyDir, rmDir, backupsRoot, listBackups } from "./lib"

export function runRestore(harnesses: HarnessId[], which?: string): void {
  for (const h of harnesses) {
    const ts = which ?? listBackups(h)[0]
    if (!ts) throw new Error(`no backup for ${h}`)
    const src = path.join(backupsRoot(h), ts)
    harnessStore(h).real.forEach((real, i) => {
      rmDir(real)
      fs.mkdirSync(path.dirname(real), { recursive: true })
      copyDir(path.join(src, `store-${i}`), real)
    })
  }
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2)
  const fi = argv.indexOf("--from")
  runRestore(parseHarnessArg(argv), fi >= 0 ? argv[fi + 1] : undefined)
  console.log("restored")
}
