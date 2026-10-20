// Persistent frame chrome shared by every wizard screen: the centered
// 70%-of-terminal frame, the HELLO OS header row, the 5-step tracker, and
// the dim footer key hints. All colors/symbols come from the design handoff
// (frame anatomy).

import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createMemo, For, Show, type JSX } from "solid-js"
import { VERSION } from "../../meta"
import { palette } from "../theme/hello-os"
import { STEP_SYMBOLS, STEP_TITLES, stepStates, type StepIndex } from "../wizard"

/** The dialog occupies 70% of the terminal on each axis; floors keep it
 *  usable on tiny terminals. Content taller than the resulting box scrolls
 *  (see `HelloSessionsFrame`) instead of corrupting sibling rows in opentui's
 *  layout engine the way an over-height box used to (see git history). */
export const FRAME_WIDTH_RATIO = 0.7
export const FRAME_HEIGHT_RATIO = 0.7
export const FRAME_MIN_WIDTH = 50
export const FRAME_MIN_HEIGHT = 14

/** The frame's own content box size — screens that size their own scrollbox
 *  (e.g. Select's session list) should budget against `height()`/`width()`
 *  here rather than raw `useTerminalDimensions()`. */
export function useFrameSize(): { width: () => number; height: () => number } {
  const dimensions = useTerminalDimensions()
  const width = createMemo(() => Math.max(FRAME_MIN_WIDTH, Math.floor(dimensions().width * FRAME_WIDTH_RATIO)))
  const height = createMemo(() => Math.max(FRAME_MIN_HEIGHT, Math.floor(dimensions().height * FRAME_HEIGHT_RATIO)))
  return { width, height }
}

export function HelloSessionsFrame(props: { children: JSX.Element }) {
  const { width, height } = useFrameSize()
  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <box flexDirection="column" width={width()} height={height()} paddingLeft={1} paddingRight={1}>
        <scrollbox flexGrow={1} scrollbarOptions={{ visible: false }}>
          {props.children}
        </scrollbox>
      </box>
    </box>
  )
}

/** HELLO OS + right-aligned dim hint (`esc`, `esc back`, or blank). */
export function Header(props: { hint?: string }) {
  return (
    <box flexDirection="row" justifyContent="space-between">
      <box flexDirection="row">
        <text fg={palette.coral} attributes={TextAttributes.BOLD}>
          {"⊙ HELLO OS"}
        </text>
        <text fg={palette.dim}>{`  v${VERSION}`}</text>
      </box>
      <text fg={palette.dim}>{props.hint ?? " "}</text>
    </box>
  )
}

/** `◼ Destination ┄┄ ◻ Source ┄┄ ◻ Select ┄┄ ◻ Import ┄┄ ◻ Done` */
export function StepTracker(props: { current: StepIndex }) {
  const states = createMemo(() => stepStates(props.current))
  return (
    <box flexDirection="row">
      <For each={[...STEP_TITLES]}>
        {(title, i) => {
          const state = () => states()[i()]!
          const color = () =>
            state() === "current" ? palette.lavender : state() === "completed" ? palette.lavenderMuted : palette.dim
          return (
            <box flexDirection="row">
              {/* @opentui/solid + solid-js 1.9.13: a `<Show>` without an
                  explicit fallback that isn't the sole child of its parent
                  inserts an orphan empty text node when false. */}
              <Show when={i() > 0} fallback={<box />}>
                <text fg={palette.connector}>{" ┄┄ "}</text>
              </Show>
              <text fg={color()} attributes={state() === "current" ? TextAttributes.BOLD : TextAttributes.NONE}>
                {`${STEP_SYMBOLS[state()]} ${title}`}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}

export interface KeyHint {
  key: string
  label: string
}

/** Footer key hints joined with ` ∙ `, e.g. `↑↓ choose ∙ ↵ next ∙ q quit`. The
 *  key glyph renders in coral so the shortcut pops out of its dim description —
 *  users kept missing that space/a/↵ were the actionable keys. */
export function KeyHints(props: { hints: KeyHint[] }) {
  return (
    <box flexDirection="row">
      <For each={props.hints}>
        {(hint, i) => (
          <box flexDirection="row">
            <Show when={i() > 0} fallback={<box />}>
              <text fg={palette.dim}>{" ∙ "}</text>
            </Show>
            <text fg={palette.coral} attributes={TextAttributes.BOLD}>
              {hint.key}
            </text>
            <text fg={palette.dim}>{` ${hint.label}`}</text>
          </box>
        )}
      </For>
    </box>
  )
}

export function Blank() {
  return <box height={1} />
}
