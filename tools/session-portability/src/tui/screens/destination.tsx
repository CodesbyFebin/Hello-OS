// Step 2 — Destination. The source is already chosen, so this is a plain
// picker: the import-capable harnesses on this machine (minus the source),
// each with its install path. The chosen source shows inline as context.

import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createMemo, createSignal, For } from "solid-js"
import type { HarnessId } from "../../ir"
import { Blank, Header, KeyHints, StepTracker } from "../ui/chrome"
import { brandDot, HARNESS_META, palette, TRANSPARENT } from "../theme/hello-os"

export interface DestinationOption {
  harness: HarnessId
  installPath: string
}

export interface DestinationScreenProps {
  options: DestinationOption[]
  source: HarnessId
  onSelect: (harness: HarnessId) => void
  onBack: () => void
}

export function DestinationScreen(props: DestinationScreenProps) {
  const [cursor, setCursor] = createSignal(0)

  function move(direction: number): void {
    const total = props.options.length
    if (total === 0) return
    setCursor((c) => ((c + direction) % total + total) % total)
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
      case "return": {
        const option = props.options[cursor()]
        if (option) props.onSelect(option.harness)
        break
      }
      case "escape":
        props.onBack()
        break
    }
  })

  const sourceMeta = createMemo(() => HARNESS_META[props.source])

  return (
    <box flexDirection="column" flexGrow={1}>
      <Header hint="esc back" />
      <Blank />
      <StepTracker current={2} />
      <Blank />
      <text fg={palette.white} attributes={TextAttributes.BOLD}>
        Where are we moving your memories to?
      </text>
      <box flexDirection="row">
        <text fg={palette.dim}>source: </text>
        <text fg={brandDot(sourceMeta().brandHex).color}>{`${brandDot(sourceMeta().brandHex).char} `}</text>
        <text fg={palette.text}>{sourceMeta().label}</text>
      </box>
      <Blank />
      <For each={props.options}>
        {(option, index) => {
          const active = createMemo(() => index() === cursor())
          const meta = HARNESS_META[option.harness]
          const dot = brandDot(meta.brandHex)
          return (
            <box
              flexDirection="row"
              justifyContent="space-between"
              backgroundColor={active() ? palette.cursorBg : TRANSPARENT}
              onMouseUp={() => {
                setCursor(index())
                props.onSelect(option.harness)
              }}
            >
              <box flexDirection="row">
                <text fg={palette.lavender} attributes={TextAttributes.BOLD}>
                  {active() ? "▌ " : "  "}
                </text>
                <text fg={dot.color}>{`${dot.char} `}</text>
                <text
                  fg={active() ? palette.lavender : palette.text}
                  attributes={active() ? TextAttributes.BOLD : TextAttributes.NONE}
                >
                  {meta.label}
                </text>
              </box>
              <text fg={palette.dim}>{option.installPath}</text>
            </box>
          )
        }}
      </For>
      <Blank />
      <KeyHints hints={[{ key: "↑↓", label: "choose" }, { key: "↵", label: "next" }, { key: "esc", label: "back" }]} />
    </box>
  )
}
