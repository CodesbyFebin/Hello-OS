// The one resolver for the porter's data root. The ledger (ledger.json) and the
// run log (logs/runs.jsonl) both live under this dir; sharing the resolver keeps
// the two from ever drifting to different roots.

import os from "os"
import path from "path"

/** `$XDG_DATA_HOME/hello-sessions`, fallback `~/.local/share/hello-sessions`. */
export function defaultDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) return path.join(xdg, "hello-sessions")
  return path.join(os.homedir(), ".local", "share", "hello-sessions")
}
