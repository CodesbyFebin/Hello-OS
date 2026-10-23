import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Session Portability | HELLO OS",
  description: "Move text sessions among Claude Code, Codex, and OpenCode with a local HELLO OS CLI. Session contents stay on your machine.",
  alternates: { canonical: "/sessions" },
};

const command = (value: string) => <code className="rounded bg-white/10 px-1.5 py-1 font-mono text-xs text-emerald-200">{value}</code>;

export default function SessionsPage() {
  return (
    <main className="min-h-screen bg-[#09090d] px-5 py-12 text-zinc-100 md:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-emerald-300 hover:underline">← HELLO OS</Link>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.22em] text-emerald-300">Local developer utility</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Session portability</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-300">Discover and move text conversations among Claude Code, Codex, and OpenCode with a local command-line wizard. The web app does not read your home directory; the CLI scans harness files only when you run it on your own machine.</p>

        <section className="mt-8 rounded-xl border border-emerald-300/20 bg-emerald-300/[.05] p-5">
          <h2 className="font-semibold">Local-only handling</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">The porting utility runs on your computer and does not upload session transcripts to HELLO OS. Session text can contain source code, credentials, or personal data. Review the selected sessions and back up destination data before importing. Tool calls, reasoning blocks, and other non-text content are not preserved by this version.</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Install and detect harnesses</h2>
          <p className="mt-2 text-sm text-zinc-400">Requires Bun. From a HELLO OS checkout:</p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-sm leading-7 text-zinc-200"><code>npm run sessions:install{"\n"}npm run sessions -- detect{"\n"}npm run sessions -- tui</code></pre>
          <p className="mt-3 text-sm text-zinc-400">The interactive wizard previews detected source sessions, lets you choose a destination and selected sessions, and reports export outcomes. For scripts, use {command("npm run sessions -- --help")}.</p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="font-semibold">What it supports</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
              <li>Read-only discovery of local Claude Code, Codex, and OpenCode sessions.</li>
              <li>Text-only transcript transfer with previews, progress, and idempotency tracking.</li>
              <li>Explicit source, destination, and session selection through the CLI or TUI.</li>
              <li>Optional isolated round-trip verification with temporary destination stores.</li>
            </ul>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="font-semibold">Limits and safeguards</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-300">
              <li>No automatic background sync. You start every transfer.</li>
              <li>Text turns only; tool calls, reasoning, and attachments may be dropped.</li>
              <li>Codex export writes local rollout data and best-effort session index metadata.</li>
              <li>Local run logs can be disabled with {command("HELLO_SESSIONS_LOG=0")} or {command("DO_NOT_TRACK=1")}.</li>
            </ul>
          </article>
        </section>

        <p className="mt-10 border-t border-white/10 pt-5 text-xs leading-5 text-zinc-500">The utility is adapted from MIT-licensed upstream code. The upstream copyright and license are preserved in <code>tools/session-portability/UPSTREAM-LICENSE</code> and <code>THIRD_PARTY_NOTICES.md</code>.</p>
      </div>
    </main>
  );
}
