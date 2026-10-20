// TUI app shell — the 5-step HELLO OS session portability wizard:
//   1 Source → 2 Destination → 3 Select → 4 Import → 5 Done
// with a persistent header + step tracker on every screen.
//
// The app scans every import-capable harness up front (on mount) so step 1
// renders with per-harness project/message counts already inline, per the
// handoff. Step 1 picks the source, step 2 picks the destination (any other
// installed harness), step 3 multi-selects that source's sessions, step 4 runs
// the one-and-only `exportSessions` dispatch, and step 5 offers `y` to import
// more (back to step 1, Source, re-scanning so the just-imported destination
// shows its updated counts).
//
// The scan caches each harness's imported sessions in `scan` — screens are
// pure views over that cache and never call `importAll` themselves, which
// also sidesteps the double-import-batch native renderer crash the previous
// composition had to work around with a replay bus.

import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { createMemo, createSignal, onMount, Show } from "solid-js"
import { registerAllAdapters } from "../adapters/index"
import type { PorterEvent } from "../core/events"
import type { LedgerRecord } from "../core/ledger"
import { Orchestrator } from "../core/orchestrator"
import { detectHarnesses, type HarnessCapability } from "../detect"
import type { HarnessId, PortableSession } from "../ir"
import { DestinationScreen } from "./screens/destination"
import { DoneScreen } from "./screens/done"
import { ImportScreen } from "./screens/import"
import { SelectScreen } from "./screens/select"
import { SourceScreen, type ScanProgress, type SourceRow } from "./screens/source"
import { HARNESS_META, HARNESS_ORDER } from "./theme/hello-os"
import { HelloSessionsFrame } from "./ui/chrome"
import { countSessions, shortenHome, withRunLogging, type StepIndex } from "./wizard"
import { createRunLogger } from "../core/log"

/** The slice of the Orchestrator the app depends on — structural, so tests
 *  can pass a lightweight mock. */
export interface AppOrchestrator {
  listSources(): Promise<HarnessId[]>
  listDestinations(): Promise<HarnessId[]>
  importAll(harness: HarnessId): Promise<PortableSession[]>
  exportSessions(dest: HarnessId, sessions: PortableSession[], opts?: { force?: boolean }): Promise<unknown>
  listExported(): Promise<LedgerRecord[]>
  reconcileLedger?(dest: HarnessId, liveDestIds: ReadonlySet<string>): Promise<number>
  events: { on(listener: (event: PorterEvent) => void): () => void }
}

export interface AppProps {
  orchestrator: AppOrchestrator
  onExit: () => void
  /** Defaults to `detectHarnesses()`; overridable for tests. */
  detect?: () => Promise<HarnessCapability[]>
}

export function App(props: AppProps) {
  const [step, setStep] = createSignal<StepIndex>(1)
  const [destinations, setDestinations] = createSignal<HarnessId[]>([])
  const [capabilities, setCapabilities] = createSignal<HarnessCapability[]>([])
  const [dest, setDest] = createSignal<HarnessId>()
  const [source, setSource] = createSignal<HarnessId>()
  const [scanning, setScanning] = createSignal(false)
  const [scanProgress, setScanProgress] = createSignal<ScanProgress | undefined>(undefined)
  const [scan, setScan] = createSignal<Partial<Record<HarnessId, PortableSession[]>>>({})
  const [exported, setExported] = createSignal<LedgerRecord[]>([])
  const [sourceHarnesses, setSourceHarnesses] = createSignal<HarnessId[]>([])
  const [scanElapsedMs, setScanElapsedMs] = createSignal(0)
  const [batch, setBatch] = createSignal<PortableSession[]>([])
  const [result, setResult] = createSignal({ messages: 0, projects: 0, elapsedMs: 0 })

  onMount(() => {
    void (async () => {
      const detect = props.detect ?? detectHarnesses
      const [dests, caps, sources] = await Promise.all([
        props.orchestrator.listDestinations(),
        detect(),
        props.orchestrator.listSources(),
      ])
      setDestinations(dests)
      setCapabilities(caps)
      setSourceHarnesses(sources)
      await scanSources(sources)
    })()
  })

  // Import every installed source up front so step 1 (Source) renders with real
  // per-harness counts instead of a fake "please wait". The orchestrator emits
  // import:start/progress as it scans each harness; surfacing them here turns a
  // silent multi-second scan into a live progress readout (see ScanProgress).
  async function scanSources(sources: HarnessId[]): Promise<void> {
    setScanning(true)
    setScanProgress(undefined)
    const startedAt = Date.now()

    const unsubscribe = props.orchestrator.events.on((event) => {
      if (event.type === "import:start") setScanProgress({ harness: event.harness, current: 0, total: event.total ?? 0 })
      else if (event.type === "import:progress") {
        setScanProgress((p) =>
          p && p.harness === event.harness ? { ...p, current: event.current ?? p.current, total: event.total ?? p.total } : p,
        )
      }
    })

    const found: Partial<Record<HarnessId, PortableSession[]>> = {}
    for (const s of sources) {
      try {
        found[s] = await props.orchestrator.importAll(s)
      } catch {
        found[s] = []
      }
    }
    unsubscribe()
    setScan(found)
    setScanElapsedMs(Date.now() - startedAt)
    setScanning(false)
    setScanProgress(undefined)
  }

  async function chooseDestination(harness: HarnessId): Promise<void> {
    setDest(harness)
    // Prune ledger records for destination conversations the user has since
    // deleted, so they stop showing as "already imported" (and a re-port
    // re-creates them). We reuse the destination's already-scanned session ids;
    // if the destination wasn't scanned as a source, skip and trust the ledger.
    const destSessions = scan()[harness]
    if (destSessions && props.orchestrator.reconcileLedger) {
      const liveDestIds = new Set(destSessions.map((s) => s.sourceSessionId))
      await props.orchestrator.reconcileLedger(harness, liveDestIds)
    }
    // Re-read on every destination choice so the "already imported" grey-out
    // reflects imports done earlier in this run (the "import more" loop).
    setExported(await props.orchestrator.listExported())
    setStep(3)
  }

  // Only harnesses installed on this machine as import sources appear here — an
  // uninstalled harness is omitted entirely rather than shown as an empty
  // "nothing here yet" row.
  const sourceRows = createMemo<SourceRow[]>(() => {
    const installed = new Set(sourceHarnesses())
    return HARNESS_ORDER.filter((harness) => installed.has(harness)).map((harness) => {
      const sessions = scan()[harness]
      if (!sessions || sessions.length === 0) return { harness, kind: "empty" as const }
      const counts = countSessions(sessions)
      return { harness, kind: "detected" as const, projects: counts.projects, messages: counts.messages }
    })
  })

  // Any installed destination that isn't the chosen source.
  const destinationOptions = createMemo(() =>
    HARNESS_ORDER.filter((harness) => harness !== source() && destinations().includes(harness)).map((harness) => ({
      harness,
      installPath: HARNESS_META[harness].installPath,
    })),
  )

  const sourceSessions = createMemo(() => (source() ? scan()[source()!] ?? [] : []))
  /** Source session ids already ported to the chosen destination (ledger hit). */
  const importedIds = createMemo(() => {
    const src = source()
    const chosen = dest()
    if (!src || !chosen) return new Set<string>()
    return new Set(
      exported()
        .filter((r) => r.sourceHarness === src && r.destHarness === chosen)
        .map((r) => r.sourceSessionId),
    )
  })
  const sourcePath = createMemo(() => {
    const cap = capabilities().find((c) => c.harness === source())
    return cap?.sourcePath ? shortenHome(cap.sourcePath) : undefined
  })
  const savedPath = createMemo(() => {
    const chosen = dest()
    if (!chosen) return ""
    const cap = capabilities().find((c) => c.harness === chosen)
    return cap?.sourcePath ? shortenHome(cap.sourcePath) : HARNESS_META[chosen].installPath
  })

  return (
    <HelloSessionsFrame>
      <Show when={step() === 1} fallback={<box />}>
        <SourceScreen
          rows={sourceRows()}
          scanning={scanning()}
          scanProgress={scanProgress()}
          scanElapsedMs={scanElapsedMs()}
          onSelect={(harness) => {
            setSource(harness)
            setStep(2)
          }}
          onQuit={props.onExit}
        />
      </Show>
      <Show when={step() === 2 && source()} fallback={<box />}>
        <DestinationScreen
          options={destinationOptions()}
          source={source()!}
          onSelect={(harness) => void chooseDestination(harness)}
          onBack={() => setStep(1)}
        />
      </Show>
      <Show when={step() === 3 && source() && dest()} fallback={<box />}>
        <SelectScreen
          source={source()!}
          dest={dest()!}
          sourcePath={sourcePath()}
          sessions={sourceSessions()}
          importedIds={importedIds()}
          onConfirm={(ids) => {
            const idSet = new Set(ids)
            setBatch(sourceSessions().filter((s) => idSet.has(s.sourceSessionId)))
            setStep(4)
          }}
          onBack={() => setStep(2)}
        />
      </Show>
      <Show when={step() === 4 && source() && dest()} fallback={<box />}>
        <ImportScreen
          orchestrator={props.orchestrator}
          dest={dest()!}
          source={source()!}
          sessions={batch()}
          onFinish={({ elapsedMs }) => {
            const counts = countSessions(batch())
            setResult({ messages: counts.messages, projects: counts.projects, elapsedMs })
            setStep(5)
          }}
        />
      </Show>
      <Show when={step() === 5 && dest()} fallback={<box />}>
        <DoneScreen
          messages={result().messages}
          projects={result().projects}
          dest={dest()!}
          savedPath={savedPath()}
          elapsedMs={result().elapsedMs}
          onImportMore={() => {
            // Re-scan on restart so the just-imported destination (which is also
            // a source) shows its updated project/message counts on step 1,
            // rather than the stale counts cached at mount.
            setStep(1)
            void scanSources(sourceHarnesses())
          }}
          onExit={props.onExit}
        />
      </Show>
    </HelloSessionsFrame>
  )
}

/** Mounts the real terminal app; resolves once the renderer is destroyed (ctrl+c / exit). */
export async function runTui(): Promise<number> {
  registerAllAdapters()
  // Interactive import: allow the opencode export to open/focus the imported
  // project in the desktop app (opt-in; off everywhere else so tests / verify /
  // library callers never launch the GUI). Set here rather than in <App> so
  // component tests that mount <App> directly never trigger it.
  process.env.HELLO_SESSIONS_OPEN_IN_DESKTOP = "1"
  // Same local run log as the headless `port` command (src/core/log.ts):
  // errors from the scan/export stream plus one summary line per Import.
  const orchestrator = withRunLogging(new Orchestrator(), createRunLogger(() => new Date().toISOString()))
  const renderer = await createCliRenderer({ exitOnCtrlC: true })

  const done = new Promise<void>((resolve) => {
    renderer.once("destroy", () => resolve())
  })

  await render(() => <App orchestrator={orchestrator} onExit={() => renderer.destroy()} />, renderer)
  await done
  return 0
}
