// Proves a ported session is RESUMABLE, not merely present: resumes it through
// the destination harness's own non-interactive CLI and checks the model
// replies. Flags verified against `--help` 2026-07-06:
//   claude --resume <id> -p "<msg>"     (print mode)
//   codex exec resume <id> "<msg>"
//   opencode run -s <id> "<msg>"
// All three have non-interactive resume, so no pty fallback is needed in v1.
//
// opencode limitation (v1.17.10, root-caused 2026-07-07): `opencode run -s`
// resolves the model FROM THE STORED SESSION and ignores both `-m` and the
// config default — a ported session whose stored model's provider isn't
// authenticated here dies with ProviderModelNotFoundError masked as
// UnknownError (and a null model crashes opencode outright). There is no CLI
// escape hatch, so before resuming we retarget the stored model to whatever
// `opencode models` says is locally available. Sandbox DB only — never the
// real store. See docs/brain/decisions/2026-07-07-first-autonomous-e2e-run.md.

import { Database } from "bun:sqlite"
import path from "node:path"
import { sandboxRoot, type HarnessId } from "./config"

export function resumeCommand(
  dest: HarnessId,
  sessionId: string,
  message: string,
): { bin: string; args: string[] } | null {
  switch (dest) {
    case "claude-code":
      return { bin: "claude", args: ["--resume", sessionId, "-p", message] }
    case "codex":
      return { bin: "codex", args: ["exec", "resume", sessionId, message] }
    case "opencode":
      return { bin: "opencode", args: ["run", "-s", sessionId, message] }
  }
}

/**
 * A provider/model pair opencode reports as usable here. Prefers a real
 * authenticated provider over the keyless `opencode/*` zen tier — zen models
 * can return empty output from non-interactive `run`, which reads as a false
 * resume failure.
 */
export function availableOpencodeModel(
  env: Record<string, string>,
): { providerID: string; modelID: string } | null {
  const r = Bun.spawnSync(["opencode", "models"], { env: { ...process.env, ...env } })
  const models = r.stdout
    .toString()
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.includes("/"))
  // Authenticated general-purpose chat model > authenticated specialized
  // (codex/realtime/audio variants reject plain chat with Bad Request) >
  // keyless zen tier.
  const authed = models.filter((m) => !m.startsWith("opencode/"))
  const general = authed.filter((m) => !/codex|realtime|audio|image/.test(m))
  const pick =
    general.find((m) => /mini|nano|small/.test(m)) ?? general[0] ?? authed[0] ?? models[0]
  if (!pick) return null
  const [providerID, ...rest] = pick.split("/")
  return { providerID: providerID!, modelID: rest.join("/") }
}

/** Rewrite a sandbox opencode session's stored model (session + message rows). */
export function retargetOpencodeSessionModel(
  dbPath: string,
  sessionId: string,
  m: { providerID: string; modelID: string },
): void {
  if (!dbPath.startsWith(sandboxRoot())) {
    throw new Error(`refusing to retarget model in non-sandbox db: ${dbPath}`)
  }
  const db = new Database(dbPath)
  try {
    db.run("UPDATE session SET model = ? WHERE id = ?", [
      JSON.stringify({ id: m.modelID, providerID: m.providerID }),
      sessionId,
    ])
    db.run(
      `UPDATE message SET data = json_set(data,'$.providerID',?,'$.modelID',?)
       WHERE session_id = ? AND json_extract(data,'$.role') = 'assistant'`,
      [m.providerID, m.modelID, sessionId],
    )
    db.run(
      `UPDATE message SET data = json_set(data,'$.model.providerID',?,'$.model.modelID',?)
       WHERE session_id = ? AND json_extract(data,'$.role') = 'user'`,
      [m.providerID, m.modelID, sessionId],
    )
  } finally {
    db.close()
  }
}

export async function probeResume(
  dest: HarnessId,
  sessionId: string,
  env: Record<string, string>,
  message = "this is a test message. reply only with 'ok'",
): Promise<{ ok: boolean; output: string }> {
  const cmd = resumeCommand(dest, sessionId, message)
  if (!cmd) return { ok: false, output: "no non-interactive resume; pty fallback required" }
  if (dest === "opencode") {
    const dbPath = env.OPENCODE_DB ?? path.join(sandboxRoot(), "opencode", "opencode.db")
    const model = availableOpencodeModel(env)
    if (!model) return { ok: false, output: "opencode reports no available models" }
    retargetOpencodeSessionModel(dbPath, sessionId, model)
  }
  const proc = Bun.spawnSync([cmd.bin, ...cmd.args], {
    env: { ...process.env, ...env },
    timeout: 120_000,
  })
  const output = proc.stdout.toString() + proc.stderr.toString()
  return { ok: /\bok\b/i.test(output), output }
}
