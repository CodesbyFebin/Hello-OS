// Step 5 — Done. Two confetti lines frame the result; `y` restarts at step 2
// (destination kept), anything else exits. The confetti twinkles by
// re-seeding a few times on mount, then settles — never loops forever (it
// competes with the [y/N] prompt).

import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createMemo, createSignal, For, onCleanup, onMount } from "solid-js"
import type { HarnessId } from "../../ir"
import { Blank, Header, StepTracker } from "../ui/chrome"
import { brandDot, HARNESS_META, palette } from "../theme/hello-os"
import { confettiSpans, formatFinalElapsed, type ConfettiColor } from "../wizard"

const CONFETTI_WIDTH = 60
const TWINKLE_TICKS = 4
const TWINKLE_INTERVAL_MS = 250

const CONFETTI_COLOR: Record<ConfettiColor, typeof palette.gold> = {
  gold: palette.gold,
  lavender: palette.lavender,
  coral: palette.coral,
}

export interface DoneScreenProps {
  messages: number
  projects: number
  dest: HarnessId
  savedPath: string
  elapsedMs: number
  onImportMore: () => void
  onExit: () => void
}

export function DoneScreen(props: DoneScreenProps) {
  const [seed, setSeed] = createSignal(1)

  onMount(() => {
    let ticks = 0
    const timer = setInterval(() => {
      setSeed((s) => s + 1)
      if (++ticks >= TWINKLE_TICKS) clearInterval(timer)
    }, TWINKLE_INTERVAL_MS)
    onCleanup(() => clearInterval(timer))
  })

  useKeyboard((key) => {
    if (key.eventType === "release") return
    if (key.name === "y") props.onImportMore()
    else if (key.name === "n" || key.name === "return" || key.name === "escape") props.onExit()
  })

  const meta = createMemo(() => HARNESS_META[props.dest])
  const dot = createMemo(() => brandDot(meta().brandHex))

  function ConfettiLine(lineProps: { offset: number }) {
    const spans = createMemo(() => confettiSpans(CONFETTI_WIDTH, seed() * 31 + lineProps.offset))
    return (
      <box flexDirection="row">
        <For each={spans()}>
          {(span) => <text fg={span.color ? CONFETTI_COLOR[span.color] : palette.dim}>{span.text}</text>}
        </For>
      </box>
    )
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <Header hint=" " />
      <StepTracker current={5} />
      <Blank />
      <ConfettiLine offset={1} />
      <box flexDirection="row">
        <text fg={palette.lavender} attributes={TextAttributes.BOLD}>
          ✓ Chat sessions ported!
        </text>
        <text fg={palette.white}>{`  ${props.messages} messages ∙ ${props.projects} projects → `}</text>
        <text fg={dot().color}>{`${dot().char} `}</text>
        <text fg={palette.white}>{meta().label}</text>
      </box>
      <ConfettiLine offset={2} />
      <Blank />
      <text fg={palette.dim}>{`${formatFinalElapsed(props.elapsedMs)} ∙ saved to ${props.savedPath}`}</text>
      <Blank />
      <box flexDirection="row">
        <text fg={palette.white} attributes={TextAttributes.BOLD}>
          {"Import more? "}
        </text>
        <text fg={palette.dim}>[</text>
        <text fg={palette.lavender} attributes={TextAttributes.BOLD}>
          y
        </text>
        <text fg={palette.dim}>/N]</text>
      </box>
      <Blank />
      <text fg={palette.dim}>ctrl+c to exit</text>
    </box>
  )
}
