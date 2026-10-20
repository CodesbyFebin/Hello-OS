// Step 1 — Welcome & source. The up-front scan runs while this screen is
// mounted, so per-harness project/message counts
// fill in inline; a harness with nothing to import is visible but not selectable.

import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import type { HarnessId } from "../../ir"
import { GITHUB_URL } from "../../meta"
import { Blank, Header, KeyHints, StepTracker } from "../ui/chrome"
import { brandDot, HARNESS_META, palette, TRANSPARENT } from "../theme/hello-os"
import { firstEnabledIndex, nextEnabledIndex, SPINNER_FRAMES, SPINNER_INTERVAL_MS } from "../wizard"

export type SourceRowKind = "detected" | "empty"

export interface SourceRow {
  harness: HarnessId
  kind: SourceRowKind
  projects?: number
  messages?: number
}

/** Live counts from the up-front source scan, driven by the orchestrator's
 *  own import:* events — real numbers, not a fake "please wait". */
export interface ScanProgress {
  harness: HarnessId
  current: number
  total: number
}

export interface SourceScreenProps {
  rows: SourceRow[]
  /** True while the app scans sources on mount, before counts are known. */
  scanning?: boolean
  scanProgress?: ScanProgress
  scanElapsedMs: number
  onSelect: (harness: HarnessId) => void
  onQuit: () => void
}

export function SourceScreen(props: SourceScreenProps) {
  const enabled = createMemo(() => props.rows.map((row) => row.kind === "detected"))
  const [cursor, setCursor] = createSignal(firstEnabledIndex(props.rows.map((row) => row.kind === "detected")))
  const [spinnerIndex, setSpinnerIndex] = createSignal(0)

  onMount(() => {
    const spinnerTimer = setInterval(() => setSpinnerIndex((i) => (i + 1) % SPINNER_FRAMES.length), SPINNER_INTERVAL_MS)
    onCleanup(() => clearInterval(spinnerTimer))
  })

  // The scan finishes while this screen is mounted, so the cursor's initial
  // landing spot (chosen when every row was still "empty") may sit on a
  // now-disabled row — snap it onto the first detected source once counts land.
  createEffect(() => {
    if (props.scanning) return
    const en = enabled()
    setCursor((c) => (en[c] ? c : firstEnabledIndex(en)))
  })

  const scanLabel = createMemo(() => {
    const progress = props.scanProgress
    if (!progress || progress.total === 0) return "loading conversations from source harnesses…"
    return `loading conversations from source harnesses… ${progress.current}/${progress.total} sessions`
  })

  useKeyboard((key) => {
    if (key.eventType === "release") return
    if (props.scanning) return
    switch (key.name) {
      case "up":
        setCursor((c) => nextEnabledIndex(c, -1, enabled()))
        break
      case "down":
        setCursor((c) => nextEnabledIndex(c, 1, enabled()))
        break
      case "return": {
        const row = props.rows[cursor()]
        if (row && row.kind === "detected") props.onSelect(row.harness)
        break
      }
      case "q":
      case "escape":
        props.onQuit()
        break
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <Header hint="esc" />
      <Blank />
      <text fg={palette.coral} attributes={TextAttributes.BOLD}>HELLO OS</text>
      <Blank />
      <text fg={palette.white}>Port your session chats between coding agents.</text>
      <text fg={palette.dim}>Coming soon: Skills ∙ MCPs ∙ Plugins</text>
      <text fg={palette.dim}>Runs locally — session contents are not uploaded.</text>
      <text fg={palette.dim}>Imports are additive & idempotent — your existing sessions are never overwritten or deleted.</text>
      <Blank />
      <StepTracker current={1} />
      <Blank />
      <text fg={palette.white} attributes={TextAttributes.BOLD}>
        Where are we importing from?
      </text>
      <Blank />
      <For each={props.rows}>
        {(row, index) => {
          const active = createMemo(() => index() === cursor())
          const selectable = row.kind === "detected"
          const meta = HARNESS_META[row.harness]
          const dot = brandDot(meta.brandHex)
          return (
            <box
              flexDirection="row"
              justifyContent="space-between"
              backgroundColor={active() ? palette.cursorBg : TRANSPARENT}
              onMouseUp={() => {
                if (!selectable || props.scanning) return
                setCursor(index())
                props.onSelect(row.harness)
              }}
            >
              <box flexDirection="row">
                <text fg={palette.lavender} attributes={TextAttributes.BOLD}>
                  {active() ? "▌ " : "  "}
                </text>
                <text fg={selectable ? dot.color : palette.dimmest}>{`${dot.char} `}</text>
                <text
                  fg={active() ? palette.lavender : selectable ? palette.text : palette.dim}
                  attributes={active() ? TextAttributes.BOLD : TextAttributes.NONE}
                >
                  {meta.label}
                </text>
              </box>
              {props.scanning ? (
                <text fg={palette.dim} attributes={TextAttributes.ITALIC}>
                  scanning…
                </text>
              ) : row.kind === "detected" ? (
                <box flexDirection="row">
                  <text fg={palette.lavender}>{`${row.projects ?? 0}`}</text>
                  <text fg={palette.dim}> projects ∙ </text>
                  <text fg={palette.lavender}>{`${row.messages ?? 0}`}</text>
                  <text fg={palette.dim}> messages</text>
                </box>
              ) : (
                <text fg={palette.dim} attributes={TextAttributes.ITALIC}>
                  nothing here yet
                </text>
              )}
            </box>
          )
        }}
      </For>
      <Blank />
      <Show
        when={props.scanning}
        fallback={<text fg={palette.dim}>{`⚡ scanned your machine in ${(props.scanElapsedMs / 1000).toFixed(1)}s`}</text>}
      >
        <box flexDirection="row">
          <text fg={palette.lavender}>{`${SPINNER_FRAMES[spinnerIndex()]} `}</text>
          <text fg={palette.dim}>{scanLabel()}</text>
        </box>
      </Show>
      <Blank />
      <Show when={!props.scanning} fallback={<box />}>
        <KeyHints hints={[{ key: "↑↓", label: "choose" }, { key: "↵", label: "continue" }, { key: "q", label: "quit" }]} />
      </Show>
      <Blank />
      <text fg={palette.dim}>Session contents stay local · MIT licensed</text>
      <box flexDirection="row">
        <text fg={palette.dim}>HELLO OS project → </text>
        <text fg={palette.lavenderMuted}>{GITHUB_URL}</text>
      </box>
    </box>
  )
}
