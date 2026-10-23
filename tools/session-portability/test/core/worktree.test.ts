// worktree -> parent-project remapping (2026-07-08 feature).
//
// Unit tests inject a fake `runGit` / `lookupConductorRepo` so they never touch
// the real git binary or the real conductor.db. Two integration tests exercise
// the real defaults: a genuine `git worktree add` (live case) and a temp SQLite
// db mimicking Conductor's schema (deleted case, via HELLO_SESSIONS_CONDUCTOR_DB).

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { Database } from "bun:sqlite"

import { PortableSession } from "../../src/ir"
import {
  CONDUCTOR_DB_ENV,
  createCwdRemapper,
  KEEP_WORKTREE_ENV,
  remapSessionCwd,
  resolveProjectRoot,
} from "../../src/core/worktree"

// git output for a LINKED worktree: common-dir and git-dir differ.
function linkedWorktreeGit(repo: string, name: string): (args: string[], cwd: string) => string {
  return () => `${repo}/.git\n${repo}/.git/worktrees/${name}\n`
}
// git output for the MAIN worktree: common-dir == git-dir.
function mainWorktreeGit(repo: string): (args: string[], cwd: string) => string {
  return () => `${repo}/.git\n${repo}/.git\n`
}

function makeSession(overrides: Partial<PortableSession> = {}): PortableSession {
  return PortableSession.parse({
    schemaVersion: "1.0.0",
    sourceHarness: "claude-code",
    sourceSessionId: "s1",
    sourcePath: "/tmp/x.jsonl",
    cwd: "/home/me/conductor/workspaces/proj/banjul",
    title: "t",
    turns: [{ role: "user", text: "hi" }],
    droppedTurns: 0,
    sourceMetadata: {},
    ...overrides,
  })
}

describe("resolveProjectRoot", () => {
  test("linked worktree resolves to the parent working tree via git", () => {
    const res = resolveProjectRoot("/wt/banjul", {
      runGit: linkedWorktreeGit("/home/me/repos/hello-sessions", "banjul"),
      lookupConductorRepo: () => null,
    })
    expect(res).toEqual({ root: "/home/me/repos/hello-sessions", source: "git" })
  })

  test("main worktree is left unchanged (not a linked worktree)", () => {
    const res = resolveProjectRoot("/home/me/repos/hello-sessions", {
      runGit: mainWorktreeGit("/home/me/repos/hello-sessions"),
      lookupConductorRepo: () => {
        throw new Error("conductor lookup must not run when git identifies a repo")
      },
    })
    expect(res).toEqual({ root: "/home/me/repos/hello-sessions", source: "none" })
  })

  test("falls back to conductor.db when git fails (deleted worktree)", () => {
    const res = resolveProjectRoot("/wt/tianjin", {
      runGit: () => null,
      lookupConductorRepo: (cwd) => (cwd === "/wt/tianjin" ? "/home/me/repos/hello-sessions" : null),
    })
    expect(res).toEqual({ root: "/home/me/repos/hello-sessions", source: "conductor" })
  })

  test("returns none when neither git nor conductor can resolve", () => {
    const res = resolveProjectRoot("/some/plain/dir", {
      runGit: () => null,
      lookupConductorRepo: () => null,
    })
    expect(res).toEqual({ root: "/some/plain/dir", source: "none" })
  })

  test("empty cwd is a no-op", () => {
    const res = resolveProjectRoot("", { runGit: () => "x", lookupConductorRepo: () => "y" })
    expect(res).toEqual({ root: "", source: "none" })
  })
})

describe("remapSessionCwd", () => {
  const deps = {
    runGit: linkedWorktreeGit("/home/me/repos/hello-sessions", "banjul"),
    lookupConductorRepo: () => null,
  }

  test("mutates cwd and stamps provenance on a worktree session", () => {
    const s = makeSession({ cwd: "/wt/banjul" })
    const res = remapSessionCwd(s, deps)
    expect(res).toEqual({ root: "/home/me/repos/hello-sessions", source: "git" })
    expect(s.cwd).toBe("/home/me/repos/hello-sessions")
    expect(s.sourceMetadata.originalCwd).toBe("/wt/banjul")
    expect(s.sourceMetadata.worktreeSource).toBe("git")
  })

  test("is idempotent — a second remap does not re-resolve or double-stamp", () => {
    const s = makeSession({ cwd: "/wt/banjul" })
    remapSessionCwd(s, deps)
    let called = false
    remapSessionCwd(s, {
      runGit: () => {
        called = true
        return "x"
      },
      lookupConductorRepo: () => null,
    })
    expect(called).toBe(false)
    expect(s.cwd).toBe("/home/me/repos/hello-sessions")
    expect(s.sourceMetadata.originalCwd).toBe("/wt/banjul")
  })

  test("leaves a non-worktree session untouched", () => {
    const s = makeSession({ cwd: "/plain/dir" })
    remapSessionCwd(s, { runGit: () => null, lookupConductorRepo: () => null })
    expect(s.cwd).toBe("/plain/dir")
    expect(s.sourceMetadata.originalCwd).toBeUndefined()
    expect(s.sourceMetadata.worktreeSource).toBeUndefined()
  })

  test(`${KEEP_WORKTREE_ENV}=1 disables remapping`, () => {
    const prev = process.env[KEEP_WORKTREE_ENV]
    process.env[KEEP_WORKTREE_ENV] = "1"
    try {
      const s = makeSession({ cwd: "/wt/banjul" })
      remapSessionCwd(s, deps)
      expect(s.cwd).toBe("/wt/banjul")
      expect(s.sourceMetadata.worktreeSource).toBeUndefined()
    } finally {
      if (prev === undefined) delete process.env[KEEP_WORKTREE_ENV]
      else process.env[KEEP_WORKTREE_ENV] = prev
    }
  })
})

describe("createCwdRemapper (memoized)", () => {
  test("resolves each distinct cwd only once across many sessions", () => {
    let gitCalls = 0
    const remap = createCwdRemapper({
      runGit: (_args, cwd) => {
        gitCalls++
        return `/home/me/repos/hello-sessions/.git\n/home/me/repos/hello-sessions/.git/worktrees/${path.basename(cwd)}\n`
      },
      lookupConductorRepo: () => null,
    })

    // 3 sessions in banjul + 2 in dakar => 2 unique cwds => 2 git calls.
    const banjul = ["a", "b", "c"].map((id) => makeSession({ sourceSessionId: id, cwd: "/wt/banjul" }))
    const dakar = ["d", "e"].map((id) => makeSession({ sourceSessionId: id, cwd: "/wt/dakar" }))
    for (const s of [...banjul, ...dakar]) remap(s)

    expect(gitCalls).toBe(2)
    for (const s of banjul) expect(s.cwd).toBe("/home/me/repos/hello-sessions")
    for (const s of dakar) expect(s.cwd).toBe("/home/me/repos/hello-sessions")
    expect(banjul[0]!.sourceMetadata.originalCwd).toBe("/wt/banjul")
    expect(dakar[0]!.sourceMetadata.originalCwd).toBe("/wt/dakar")
  })
})

describe("resolveProjectRoot — real integrations", () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"))
  })
  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {}
  })

  test("real `git worktree add` resolves to the main repo (live case)", () => {
    const repo = path.join(tmp, "repo")
    fs.mkdirSync(repo)
    const git = (args: string[], cwd: string) =>
      execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    git(["init", "-q", "-b", "main"], repo)
    git(["config", "user.email", "t@t.dev"], repo)
    git(["config", "user.name", "t"], repo)
    fs.writeFileSync(path.join(repo, "f.txt"), "x")
    git(["add", "."], repo)
    git(["commit", "-qm", "init"], repo)
    const wt = path.join(tmp, "banjul")
    git(["worktree", "add", "-q", wt, "-b", "feat"], repo)

    // fs.realpathSync collapses macOS /var -> /private/var so the assertion holds.
    const res = resolveProjectRoot(fs.realpathSync(wt), { lookupConductorRepo: () => null })
    expect(res.source).toBe("git")
    expect(fs.realpathSync(res.root)).toBe(fs.realpathSync(repo))

    // the main worktree itself must NOT be remapped
    const main = resolveProjectRoot(fs.realpathSync(repo), { lookupConductorRepo: () => null })
    expect(main.source).toBe("none")
  })

  test("real conductor.db resolves a deleted worktree (durable case)", () => {
    const dbPath = path.join(tmp, "conductor.db")
    const db = new Database(dbPath)
    db.run("CREATE TABLE repos (id TEXT, root_path TEXT)")
    db.run("CREATE TABLE workspaces (workspace_path TEXT, repository_id TEXT, state TEXT)")
    db.run("INSERT INTO repos VALUES ('r1', '/home/me/repos/hello-sessions')")
    db.run(
      "INSERT INTO workspaces VALUES ('/gone/conductor/workspaces/proj/tianjin', 'r1', 'archived')",
    )
    db.close()

    const prev = process.env[CONDUCTOR_DB_ENV]
    process.env[CONDUCTOR_DB_ENV] = dbPath
    try {
      // git fails because the worktree dir does not exist -> conductor fallback.
      const res = resolveProjectRoot("/gone/conductor/workspaces/proj/tianjin")
      expect(res).toEqual({ root: "/home/me/repos/hello-sessions", source: "conductor" })
    } finally {
      if (prev === undefined) delete process.env[CONDUCTOR_DB_ENV]
      else process.env[CONDUCTOR_DB_ENV] = prev
    }
  })
})
