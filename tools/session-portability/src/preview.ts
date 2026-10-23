// Derive a human-readable session preview from raw turn text.
//
// Harness session files don't persist a generated chat title — only the
// Desktop/cloud app does, and it never writes that title back to the local
// `.jsonl`/rollout files we read. So the best local signal for a title is the
// first *real* human message, with two kinds of noise removed:
//   1. Slash-command wrappers (`<command-name>/foo</command-name>` …) — the bare
//      command name reads far better than the raw XML.
//   2. Injected boilerplate (Conductor `<system_instruction>`, `<system-reminder>`,
//      codex `# AGENTS.md` / `<INSTRUCTIONS>`) that leaks in as the "first message"
//      but isn't anything the user typed — skip such turns entirely.

const BOILERPLATE_BLOCKS: RegExp[] = [
  /<system_instruction>[\s\S]*?<\/system_instruction>/gi,
  /<system-reminder>[\s\S]*?<\/system-reminder>/gi,
  /<user-prompt-submit-hook>[\s\S]*?<\/user-prompt-submit-hook>/gi,
  /<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/gi,
  // Claude Code slash-command machinery: caveat banner + stdout/stderr echo of
  // the command result ("Enabled plan mode", "Login successful", …) — not a turn
  // the user typed, so it shouldn't stand in as "the next message".
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/gi,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/gi,
  /<local-command-stderr>[\s\S]*?<\/local-command-stderr>/gi,
]

/** ESC[…m and other CSI escape sequences that leak in from tool output. */
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g

/** Prefixes that mark a turn as pure injected boilerplate, not a human message. */
const BOILERPLATE_PREFIXES = [
  "# AGENTS.md",
  "You are working inside Conductor",
  "Caveat:",
  "[Request interrupted",
]

function commandLabel(text: string): string | undefined {
  const name = text.match(/<command-name>\s*([^<]+?)\s*<\/command-name>/i)?.[1]
  if (name) return name.trim()
  const message = text.match(/<command-message>\s*([^<]+?)\s*<\/command-message>/i)?.[1]
  return message?.trim() || undefined
}

/** Clean one turn's raw text into a display preview, or "" if it's pure boilerplate. */
export function cleanTurnPreview(raw: string): string {
  const text = (raw ?? "").trim()
  if (!text) return ""

  const command = commandLabel(text)
  if (command) return command

  let stripped = text.replace(ANSI, "")
  for (const block of BOILERPLATE_BLOCKS) stripped = stripped.replace(block, " ")
  stripped = stripped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (!stripped) return ""
  if (BOILERPLATE_PREFIXES.some((p) => stripped.startsWith(p))) return ""
  return stripped
}

/** Below this, a preview (e.g. a bare "/plan") is too terse to stand alone. */
const MIN_INFORMATIVE = 24

/**
 * Pick a display preview from ordered user-turn texts: the first turn that
 * survives boilerplate/command cleaning, truncated to `max`. When that turn is
 * very short (e.g. a bare slash command), following turns are appended with a
 * " • " separator for context ("/plan • lets add more rows"). "" if none survive.
 */
export function derivePreview(userTexts: Iterable<string>, max = 60): string {
  const cleaned: string[] = []
  for (const raw of userTexts) {
    const c = cleanTurnPreview(raw)
    if (c) cleaned.push(c)
  }
  if (cleaned.length === 0) return ""

  let out = cleaned[0]!
  for (let i = 1; i < cleaned.length && out.length < MIN_INFORMATIVE; i++) {
    out += " • " + cleaned[i]
  }
  return out.length > max ? out.slice(0, max) : out
}
