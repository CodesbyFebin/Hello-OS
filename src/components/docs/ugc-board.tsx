"use client";

import * as React from "react";
import { Send, ShieldCheck, MessageSquareText } from "lucide-react";

type Post = { id: string; author: string; title: string; body: string; repo: string; receipt: string; createdAt: string };
type Issue = { path: string; message: string };

const input = "w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#43e6a5]/50";

export function UgcBoard() {
  const [posts, setPosts] = React.useState<Post[] | null>(null);
  const [loadError, setLoadError] = React.useState("");
  const [form, setForm] = React.useState({ author: "", title: "", body: "", repo: "" });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string; issues?: Issue[] } | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/docs/posts", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setPosts((await r.json()).posts); setLoadError("");
    } catch (e) { setLoadError(e instanceof Error ? e.message : "failed to load"); setPosts([]); }
  }, []);
  React.useEffect(() => { const t = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(t); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const body = { author: form.author, title: form.title, body: form.body, ...(form.repo.trim() ? { repo: form.repo.trim() } : {}) };
      const r = await fetch("/api/docs/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: j.error || `HTTP ${r.status}`, issues: j.issues }); return; }
      setMsg({ ok: true, text: `Stored. Receipt sha256:${j.post.receipt.slice(0, 16)}…` });
      setForm({ author: "", title: "", body: "", repo: "" });
      await load();
    } catch { setMsg({ ok: false, text: "network error" }); } finally { setBusy(false); }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/[.07] bg-[#0f1019]/80 p-4" aria-labelledby="ugc-form-h">
        <h2 id="ugc-form-h" className="text-sm font-semibold text-white">Submit a field report</h2>
        <p className="text-xs text-zinc-500">Stored in this instance&apos;s database as plain text. Limit: 3 reports per 10 minutes.</p>
        <label className="block text-xs text-zinc-400">Author (name or DID)<input required minLength={2} maxLength={60} value={form.author} onChange={set("author")} className={input} placeholder="did:key:z… or your name" /></label>
        <label className="block text-xs text-zinc-400">Title<input required minLength={4} maxLength={140} value={form.title} onChange={set("title")} className={input} /></label>
        <label className="block text-xs text-zinc-400">Report<textarea required minLength={20} maxLength={4000} rows={6} value={form.body} onChange={set("body")} className={input} placeholder="What you ran, what happened, how to reproduce." /></label>
        <label className="block text-xs text-zinc-400">Repo (optional)<input maxLength={120} pattern="[\w.\-/]*" value={form.repo} onChange={set("repo")} className={input} placeholder="owner/name" /></label>
        <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-[#43e6a5] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"><Send size={13} aria-hidden />{busy ? "Submitting…" : "Submit report"}</button>
        {msg && (
          <div role="status" className={`text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>
            {msg.text}
            {msg.issues && <ul className="mt-1 list-disc pl-4">{msg.issues.map((i) => <li key={i.path + i.message}>{i.path}: {i.message}</li>)}</ul>}
          </div>
        )}
      </form>

      <section aria-labelledby="ugc-list-h" className="rounded-xl border border-white/[.07] bg-[#0f1019]/80">
        <h2 id="ugc-list-h" className="border-b border-white/[.07] px-4 py-3 text-sm font-semibold text-white">Field reports {posts && <span className="font-mono text-xs text-zinc-500">({posts.length})</span>}</h2>
        {posts === null ? <p className="p-6 text-sm text-zinc-500">Loading…</p>
          : loadError ? <p className="p-6 text-sm text-rose-300">Could not load reports: {loadError}</p>
          : posts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-zinc-500"><MessageSquareText size={22} aria-hidden />No field reports yet. The first one you submit appears here.</div>
          ) : (
            <ul className="divide-y divide-white/[.05]">
              {posts.map((p) => (
                <li key={p.id} className="space-y-1.5 px-4 py-3">
                  <h3 className="font-medium text-zinc-100">{p.title}</h3>
                  <div className="font-mono text-[11px] text-zinc-500">{p.author} · <time dateTime={p.createdAt}>{new Date(p.createdAt).toLocaleString()}</time>{p.repo && <> · repo {p.repo}</>}</div>
                  <p className="whitespace-pre-wrap text-sm text-zinc-300">{p.body}</p>
                  <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-500" title="SHA-256 over the stored fields, computed by the server"><ShieldCheck size={12} aria-hidden />receipt sha256:{p.receipt}</div>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
