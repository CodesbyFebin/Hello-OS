// Step 4 — Import progress. Kicks off the export batch on mount and renders
// live progress from the orchestrator's export:* event stream: quarter-moon
// spinner + rotating microcopy, a 24-cell trail per category (only Chats is
// real in v1 — the rest read `┄ soon`), and per-project detail lines.

import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { PorterEvent } from "../../core/events"
import type { HarnessId, PortableSession } from "../../ir"
import { Blank, Header, StepTracker } from "../ui/chrome"
import { brandFg, HARNESS_META, palette } from "../theme/hello-os"
import {
  formatTickingElapsed,
  groupSessionsByProject,
  IMPORT_MICROCOPY,
  MICROCOPY_INTERVAL_MS,
  progressTrail,
  projectDisplay,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
  truncateEnd,
} from "../wizard"

const SOON_CATEGORIES = ["Skills", "MCPs", "Plugins", "CLAUDE.md"]
const LABEL_COLUMN_WIDTH = 11

export interface ImportOrchestrator {
  exportSessions(dest: HarnessId, sessions: PortableSession[], opts?: { force?: boolean }): Promise<unknown>
  events: { on(listener: (event: PorterEvent) => void): () => void }
}

export interface ImportScreenProps {
  orchestrator: ImportOrchestrator
  dest: HarnessId
  source: HarnessId
  sessions: PortableSession[]
  onFinish: (result: { elapsedMs: number }) => void
}

export function ImportScreen(props: ImportScreenProps) {
  const [doneIds, setDoneIds] = createSignal<ReadonlySet<string>>(new Set<string>())
  const [spinnerIndex, setSpinnerIndex] = createSignal(0)
  const [microcopyIndex, setMicrocopyIndex] = createSignal(0)
  const [elapsedMs, setElapsedMs] = createSignal(0)

  const startedAt = Date.now()
  let finished = false

  const unsubscribe = props.orchestrator.events.on((event) => {
    if (event.harness !== props.dest) return
    if ((event.type === "export:progress" || event.type === "error") && event.sourceSessionId) {
      const id = event.sourceSessionId
      setDoneIds((ids) => (ids.has(id) ? ids : new Set(ids).add(id)))
    }
    if (event.type === "export:done" && !finished) {
      finished = true
      props.onFinish({ elapsedMs: Date.now() - startedAt })
    }
  })
  onCleanup(unsubscribe)

  onMount(() => {
    const spinner = setInterval(() => setSpinnerIndex((i) => (i + 1) % SPINNER_FRAMES.length), SPINNER_INTERVAL_MS)
    const microcopy = setInterval(
      () => setMicrocopyIndex((i) => (i + 1) % IMPORT_MICROCOPY.length),
      MICROCOPY_INTERVAL_MS,
    )
    const ticker = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000)
    onCleanup(() => {
      clearInterval(spinner)
      clearInterval(microcopy)
      clearInterval(ticker)
    })
    void props.orchestrator.exportSessions(props.dest, props.sessions)
  })

  // esc is deliberately not wired — the handoff's only step-4 exit is ctrl+c
  // (handled globally by the renderer's exitOnCtrlC).
  useKeyboard(() => {})

  const totalMessages = createMemo(() => props.sessions.reduce((sum, s) => sum + s.turns.length, 0))
  const importedMessages = createMemo(() =>
    props.sessions.reduce((sum, s) => (doneIds().has(s.sourceSessionId) ? sum + s.turns.length : sum), 0),
  )
  const currentSession = createMemo(() => props.sessions.find((s) => !doneIds().has(s.sourceSessionId)))
  const projectGroups = createMemo(() => groupSessionsByProject(props.sessions))
  const projectsDone = createMemo(
    () => projectGroups().filter(([, group]) => group.every((s) => doneIds().has(s.sourceSessionId))).length,
  )

  const trail = createMemo(() => progressTrail(importedMessages(), totalMessages()))

  const currentDetail = createMemo(() => {
    const session = currentSession()
    if (!session) return undefined
    const messages = session.turns.length
    const label = `${projectDisplay(session.cwd).name}/${session.title}`
    return `→ ${truncateEnd(label, 48)} ∙ ${messages} message${messages === 1 ? "" : "s"}`
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <Header hint=" " />
      <StepTracker current={4} />
      <Blank />
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="row">
          <text fg={palette.lavender} attributes={TextAttributes.BOLD}>
            {`${SPINNER_FRAMES[spinnerIndex()]} `}
          </text>
          <text fg={palette.white} attributes={TextAttributes.BOLD}>
            {IMPORT_MICROCOPY[microcopyIndex()]}
          </text>
          <text fg={palette.dim}>{` → ${HARNESS_META[props.dest].label}`}</text>
        </box>
        <text fg={palette.dim}>{formatTickingElapsed(elapsedMs())}</text>
      </box>
      <Blank />
      <box flexDirection="row">
        <box width={LABEL_COLUMN_WIDTH}>
          <text fg={palette.text}>Chats</text>
        </box>
        <text fg={palette.lavender}>{trail().filled}</text>
        <text fg={brandFg(HARNESS_META[props.source].brandHex)}>{trail().head}</text>
        <text fg={palette.connector}>{trail().rest}</text>
        <text fg={palette.lavender}>{` ${importedMessages()}`}</text>
        <text fg={palette.dim}>{`/${totalMessages()} messages`}</text>
      </box>
      {SOON_CATEGORIES.map((category) => (
        <box flexDirection="row">
          <box width={LABEL_COLUMN_WIDTH}>
            <text fg={palette.dimmest}>{category}</text>
          </box>
          <text fg={palette.dimmest}>┄ soon</text>
        </box>
      ))}
      <Blank />
      <Show when={currentDetail()} fallback={<box />}>
        <text fg={palette.dim}>{currentDetail()}</text>
      </Show>
      <box flexDirection="row">
        <text fg={palette.lavenderMuted}>{"✔ "}</text>
        <text fg={palette.dim}>
          {`${projectsDone()} project${projectsDone() === 1 ? "" : "s"} done ∙ ${projectGroups().length - projectsDone()} to go`}
        </text>
      </box>
      <Blank />
      <text fg={palette.dim}>ctrl+c cancel</text>
    </box>
  )
}
