// Step 3 — Select chats. The redesign of the old session picker: keeps its
// behavior (group sessions by project, right-aligned message counts,
// scrollable list) with the new chrome — lavender palette, ▌-bar cursor row
// instead of the orange highlight bar, ◉/○ checkboxes, pill tab bar, header +
// step tracker. Nothing is selected by default (least-astonishment: importing
// everything shouldn't be the silent default) — with no explicit selection ↵
// imports the focused row, fzf-style; space toggles, `a` selects all.

import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createMemo, createSignal, For, Show } from "solid-js"
import type { HarnessId, PortableSession } from "../../ir"
import { Blank, Header, KeyHints, StepTracker, useFrameSize } from "../ui/chrome"
import { brandDot, HARNESS_META, palette, TRANSPARENT } from "../theme/hello-os"
import {
  firstEnabledIndex,
  groupSessionsByProject,
  nextEnabledIndex,
  projectDisplay,
  resolveImportIds,
  selectAllSessions,
  toggleSessionSelection,
  truncateEnd,
} from "../wizard"

const SOON_TABS = ["Skills", "MCPs", "Plugins", "CLAUDE.md"]

/** Frame's inner width minus padding(2) + bar(1) + checkbox(2) + count
 *  gutter(~19) — deterministic string truncation instead of flex clipping
 *  (see wizard.truncateEnd). Scales with the frame, so a wider terminal
 *  (70% of it) shows more of each conversation's title. */
const ROW_CHROME_CHARS = 22

type ListRow =
  | { kind: "header"; name: string; parent: string }
  | { kind: "session"; session: PortableSession; sessionIndex: number }

export interface SelectScreenProps {
  source: HarnessId
  dest: HarnessId
  /** The source harness's data dir, ~-shortened, for the context line. */
  sourcePath?: string
  sessions: PortableSession[]
  /** Source session ids already ported to this destination (grayed + skipped). */
  importedIds?: ReadonlySet<string>
  onConfirm: (sessionIds: string[]) => void
  onBack: () => void
}

export function SelectScreen(props: SelectScreenProps) {
  const imported = createMemo(() => props.importedIds ?? new Set<string>())
  const isImported = (session: PortableSession) => imported().has(session.sourceSessionId)

  const grouped = createMemo(() => groupSessionsByProject(props.sessions))
  const ordered = createMemo(() => grouped().flatMap(([, group]) => group))
  /** Per-session-index navigability: already-imported rows are skipped. */
  const enabled = createMemo(() => ordered().map((session) => !isImported(session)))

  const [selected, setSelected] = createSignal<Set<string>>(new Set<string>())
  const [cursor, setCursor] = createSignal(firstEnabledIndex(enabled()))

  const rows = createMemo<ListRow[]>(() => {
    const out: ListRow[] = []
    let sessionIndex = 0
    for (const [cwd, group] of grouped()) {
      const { name, parent } = projectDisplay(cwd)
      out.push({ kind: "header", name, parent })
      for (const session of group) out.push({ kind: "session", session, sessionIndex: sessionIndex++ })
    }
    return out
  })

  /** Cursor's index among the scrollbox's children (headers included). */
  const cursorRowIndex = createMemo(() => rows().findIndex((row) => row.kind === "session" && row.sessionIndex === cursor()))

  let scroll: ScrollBoxRenderable | undefined

  function scrollToCursor(): void {
    if (!scroll) return
    const target = scroll.getChildren()[cursorRowIndex()]
    if (!target) return
    const y = target.y - scroll.y
    if (y >= scroll.height) scroll.scrollBy(y - scroll.height + 1)
    if (y < 0) scroll.scrollBy(y)
  }

  function move(direction: number): void {
    if (ordered().length === 0) return
    const step = direction < 0 ? -1 : 1
    let next = cursor()
    for (let i = 0; i < Math.abs(direction); i++) next = nextEnabledIndex(next, step, enabled())
    setCursor(next)
    scrollToCursor()
  }

  function toggleCursor(): void {
    const session = ordered()[cursor()]
    if (session && !isImported(session)) setSelected((s) => toggleSessionSelection(s, session.sourceSessionId))
  }

  function toggleAll(): void {
    const selectable = selectAllSessions(props.sessions, imported())
    setSelected((s) => (s.size === selectable.size ? new Set<string>() : selectable))
  }

  /** Single source of truth for what ↵ imports — the fzf fallback lives in
   *  wizard.resolveImportIds so the footer label and confirm() never disagree. */
  const importIds = createMemo(() => resolveImportIds(ordered(), selected(), cursor(), (s) => !isImported(s)))

  function confirm(): void {
    const ids = importIds()
    if (ids.length > 0) props.onConfirm(ids)
  }

  useKeyboard((key) => {
    if (key.eventType === "release") return
    switch (key.name) {
      case "up":
        move(-1)
        break
      case "down":
        move(1)
        break
      case "pageup":
        move(-10)
        break
      case "pagedown":
        move(10)
        break
      case "space":
        toggleCursor()
        break
      case "a":
        toggleAll()
        break
      case "return":
        confirm()
        break
      case "escape":
        props.onBack()
        break
    }
  })

  const selectedCount = createMemo(() => selected().size)
  const selectableCount = createMemo(() => props.sessions.length - imported().size)
  const selectedMessages = createMemo(() =>
    props.sessions.reduce((sum, s) => (selected().has(s.sourceSessionId) ? sum + s.turns.length : sum), 0),
  )
  const summaryLabel = createMemo(() => {
    if (selectedCount() === 0) return "none selected"
    if (selectedCount() === selectableCount()) return `all ${selectableCount()} selected`
    return `${selectedCount()} of ${selectableCount()} selected`
  })
  const importLabel = createMemo(() =>
    selectedCount() > 0 ? `↵ import ${selectedCount()} selected` : "↵ import this chat",
  )

  // header(1) + tracker moved next to header per mock (1) + tabs(1) + context(1)
  // + hints(1) + blank(2) + summary(1) = 8 fixed rows inside the frame. Hints
  // sit above the list so they stay pinned when the frame scrolls.
  const { width: frameWidth, height: frameHeight } = useFrameSize()
  const listMaxHeight = createMemo(() => Math.max(3, Math.min(rows().length, frameHeight() - 8)))
  const previewMaxChars = createMemo(() => Math.max(20, frameWidth() - 2 - ROW_CHROME_CHARS))

  const sourceDot = brandDot(HARNESS_META[props.source].brandHex)
  const destDot = brandDot(HARNESS_META[props.dest].brandHex)

  return (
    <box flexDirection="column" flexGrow={1}>
      <Header hint="esc back" />
      <StepTracker current={3} />
      <Blank />
      <box flexDirection="row">
        <box backgroundColor={palette.pillBg}>
          <text fg={palette.lavender} attributes={TextAttributes.BOLD}>
            {" Chats "}
          </text>
        </box>
        <text fg={palette.dimmest}>{`  Coming Soon: ${SOON_TABS.join(" • ")}`}</text>
      </box>
      <box flexDirection="row">
        <text fg={sourceDot.color}>{`${sourceDot.char} `}</text>
        <text fg={palette.dim}>{`${HARNESS_META[props.source].label} → `}</text>
        <text fg={destDot.color}>{`${destDot.char} `}</text>
        <text fg={palette.dim}>{HARNESS_META[props.dest].label + (props.sourcePath ? ` ∙ ${props.sourcePath}` : "")}</text>
      </box>
      <Blank />
      <KeyHints
        hints={[
          { key: "↑↓", label: "move" },
          { key: "space", label: "toggle" },
          { key: "a", label: "select all" },
          { key: "esc", label: "back" },
        ]}
      />
      <scrollbox scrollbarOptions={{ visible: false }} maxHeight={listMaxHeight()} ref={(r: ScrollBoxRenderable) => (scroll = r)}>
        <For each={rows()}>
          {(row) => {
            if (row.kind === "header") {
              return (
                <box flexDirection="row">
                  <text fg={palette.coral} attributes={TextAttributes.BOLD}>
                    {`▍${row.name}`}
                  </text>
                  <text fg={palette.dim}>{row.parent ? ` ${row.parent}` : ""}</text>
                </box>
              )
            }
            const session = row.session
            const done = isImported(session)
            const active = createMemo(() => cursor() === row.sessionIndex)
            const checked = createMemo(() => selected().has(session.sourceSessionId))
            const messages = session.turns.length
            return (
              <box
                flexDirection="row"
                justifyContent="space-between"
                backgroundColor={active() ? palette.cursorBg : TRANSPARENT}
                onMouseUp={() => {
                  if (done) return
                  setCursor(row.sessionIndex)
                  setSelected((s) => toggleSessionSelection(s, session.sourceSessionId))
                }}
              >
                <box flexDirection="row">
                  <text fg={palette.lavender} attributes={TextAttributes.BOLD}>
                    {active() ? "▌" : " "}
                  </text>
                  <text fg={done ? palette.dimmest : checked() ? palette.lavender : palette.dim}>
                    {done ? "· " : checked() ? "◉ " : "○ "}
                  </text>
                  <text fg={done ? palette.dimmest : active() ? palette.white : palette.text}>
                    {truncateEnd(session.title, previewMaxChars())}
                  </text>
                </box>
                <text fg={done ? palette.dimmest : active() ? palette.cursorCount : palette.dim}>
                  {done ? "already imported" : `${messages} message${messages === 1 ? "" : "s"}`}
                </text>
              </box>
            )
          }}
        </For>
      </scrollbox>
      <Blank />
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="row">
          <text fg={selectedCount() > 0 ? palette.lavender : palette.dim}>
            {`${selectedCount() > 0 ? "◉" : "○"} ${summaryLabel()}`}
          </text>
          <text fg={palette.dim}>{` ∙ ${selectedMessages()} messages`}</text>
        </box>
        <Show when={importIds().length > 0} fallback={<box />}>
          <text fg={palette.lavender} attributes={TextAttributes.BOLD} onMouseUp={() => confirm()}>
            {importLabel()}
          </text>
        </Show>
      </box>
    </box>
  )
}
