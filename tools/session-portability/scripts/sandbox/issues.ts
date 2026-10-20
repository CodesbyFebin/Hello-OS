import fs from "node:fs"
import path from "node:path"
import { sandboxRoot, type HarnessId } from "./config"

export interface Issue {
  at: string
  sourceHarness: HarnessId
  destHarness: HarnessId
  sessionId: string
  project: string
  phase: "port" | "store-check" | "resume" | "desktop"
  message: string
  log?: string
}

function issuesFile(): string {
  return path.join(sandboxRoot(), "issues.jsonl")
}

export function logIssue(issue: Issue): void {
  fs.mkdirSync(sandboxRoot(), { recursive: true })
  fs.appendFileSync(issuesFile(), JSON.stringify(issue) + "\n")
}

export function readIssues(): Issue[] {
  const f = issuesFile()
  if (!fs.existsSync(f)) return []
  return fs
    .readFileSync(f, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Issue)
}
