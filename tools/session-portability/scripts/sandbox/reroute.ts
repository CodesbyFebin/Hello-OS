import { writeEnv, appReadEnv, ledgerEnv, type HarnessId } from "./config"
import { parseHarnessArg } from "./lib"

export function rerouteLines(harnesses: HarnessId[], mode: "write" | "app"): string[] {
  const pick = mode === "write" ? writeEnv : appReadEnv
  const out: string[] = []
  for (const h of harnesses) {
    for (const [k, v] of Object.entries(pick(h))) out.push(`export ${k}=${v}`)
  }
  if (mode === "write") {
    for (const [k, v] of Object.entries(ledgerEnv())) out.push(`export ${k}=${v}`)
  }
  return out
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2)
  const mode = argv.includes("--app") ? "app" : "write"
  console.log(rerouteLines(parseHarnessArg(argv), mode).join("\n"))
}
