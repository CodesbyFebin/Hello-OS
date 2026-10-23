// Seeds the SANDBOX claude-code store from real conversations, preserving the
// projects/<encoded-cwd>/<id>.jsonl layout so seeded convos are portable
// sources. Round-robins across the first M project dirs so N convos spread as
// evenly as the source data allows. Read-only against the real store.

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { harnessStore } from "./config"

export interface SeedOpts {
  projects: number
  convos: number
  sourceRoot: string
}

export function runSeed(opts: SeedOpts): { project: string; file: string }[] {
  const projectDirs = fs
    .readdirSync(opts.sourceRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const files = fs.readdirSync(path.join(opts.sourceRoot, name))
      return files.some((f) => f.endsWith(".jsonl"))
    })
    .slice(0, opts.projects)

  const picked: { project: string; file: string }[] = []
  outer: for (let round = 0; ; round++) {
    let progressed = false
    for (const proj of projectDirs) {
      const files = fs
        .readdirSync(path.join(opts.sourceRoot, proj))
        .filter((f) => f.endsWith(".jsonl"))
        .sort()
      if (round < files.length) {
        picked.push({ project: proj, file: path.join(opts.sourceRoot, proj, files[round]!) })
        progressed = true
        if (picked.length >= opts.convos) break outer
      }
    }
    if (!progressed) break
  }

  const sandboxProjectsRoot = harnessStore("claude-code").sandbox[0]!
  for (const p of picked) {
    const dst = path.join(sandboxProjectsRoot, p.project)
    fs.mkdirSync(dst, { recursive: true })
    fs.copyFileSync(p.file, path.join(dst, path.basename(p.file)))
  }
  return picked
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2)
  const num = (flag: string, def: number) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? Number(argv[i + 1]) : def
  }
  const si = argv.indexOf("--source-root")
  const sourceRoot = si >= 0 ? argv[si + 1]! : path.join(os.homedir(), ".claude", "projects")
  const picked = runSeed({ projects: num("--projects", 3), convos: num("--convos", 5), sourceRoot })
  const projects = new Set(picked.map((p) => p.project)).size
  console.log(`seeded ${picked.length} convos across ${projects} projects`)
  for (const p of picked) console.log(`  ${p.project}/${path.basename(p.file)}`)
}
