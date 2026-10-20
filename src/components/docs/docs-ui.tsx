import Link from "next/link";
import { BookOpen, CircleCheck, FlaskConical, Telescope, ArrowRight, ArrowLeft } from "lucide-react";
import type { DocPage, Feature, Status, Table } from "@/lib/docs/content";
import { DOC_PAGES } from "@/lib/docs/content";

export const SITE_URL = (process.env.HELLO_PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");

const STATUS: Record<Status, { label: string; cls: string; Icon: typeof CircleCheck }> = {
  implemented: { label: "Implemented", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", Icon: CircleCheck },
  prototype: { label: "Prototype", cls: "border-sky-400/30 bg-sky-400/10 text-sky-300", Icon: FlaskConical },
  vision: { label: "Vision", cls: "border-violet-400/30 bg-violet-400/10 text-violet-300", Icon: Telescope },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${s.cls}`}><s.Icon size={11} aria-hidden />{s.label.toUpperCase()}</span>;
}

export function JsonLd({ data }: { data: unknown }) {
  // Static, server-built schema.org data only (never user content). "<" is
  // escaped so the payload cannot close the script element.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function DocsSidebar({ current }: { current?: string }) {
  return (
    <nav aria-label="Docs pages" className="lg:sticky lg:top-20">
      <Link href="/docs" className={`mb-3 flex items-center gap-2 font-mono text-xs ${!current ? "text-[#43e6a5]" : "text-zinc-400 hover:text-white"}`}><BookOpen size={14} aria-hidden />HELLO OS docs</Link>
      <ol className="space-y-0.5">
        {DOC_PAGES.map((p) => (
          <li key={p.slug}>
            <Link href={`/docs/${p.slug}`} aria-current={current === p.slug ? "page" : undefined}
              className={`flex gap-2 rounded-md px-2 py-1.5 text-[13px] ${current === p.slug ? "bg-[#43e6a5]/10 text-[#43e6a5]" : "text-zinc-400 hover:bg-white/[.04] hover:text-white"}`}>
              <span className="font-mono text-[11px] text-zinc-600">{String(p.n).padStart(2, "0")}</span>{p.tab}
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-lg border border-white/[.07] p-3 text-[11px] leading-relaxed text-zinc-500">
        <div className="mb-1.5 flex flex-wrap gap-1"><StatusBadge status="implemented" /><StatusBadge status="prototype" /><StatusBadge status="vision" /></div>
        Implemented links to a real route. Prototype works with stated limits. Vision is design only.
      </div>
    </nav>
  );
}

export function DirectAnswer({ question, answer }: { question: string; answer: string }) {
  return (
    <section aria-labelledby="direct-answer">
      <h1 id="direct-answer" className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{question}</h1>
      <div className="mt-4 rounded-xl border border-[#43e6a5]/25 bg-[#43e6a5]/[.05] p-4">
        <div className="mb-1 font-mono text-[10px] tracking-[.18em] text-[#43e6a5]">DIRECT ANSWER</div>
        <p className="text-[15px] leading-relaxed text-zinc-200">{answer}</p>
      </div>
    </section>
  );
}

export function FeatureList({ features }: { features: Feature[] }) {
  return (
    <section aria-labelledby="status-h" className="rounded-xl border border-white/[.07] bg-[#0f1019]/80">
      <h2 id="status-h" className="border-b border-white/[.07] px-4 py-3 text-sm font-semibold text-white">What exists in the repo</h2>
      <ul className="divide-y divide-white/[.05]">
        {features.map((f) => (
          <li key={f.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <StatusBadge status={f.status} />
            <span className="font-medium text-zinc-100">{f.name}</span>
            <span className="text-zinc-500">{f.detail}</span>
            {f.href && <Link href={f.href} className="ml-auto font-mono text-xs text-[#43e6a5] hover:underline">{f.href}</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DocTable({ t }: { t: Table }) {
  return (
    <figure className="overflow-x-auto rounded-xl border border-white/[.07]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="border-b border-white/[.07] px-4 py-3 text-left text-sm font-semibold text-white">{t.caption}</caption>
        <thead className="font-mono text-[10px] tracking-wider text-zinc-500"><tr>{t.head.map((h) => <th key={h} scope="col" className="px-4 py-2">{h.toUpperCase()}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/[.05]">{t.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => i === 0 ? <th key={i} scope="row" className="px-4 py-2.5 font-medium text-zinc-100">{c}</th> : <td key={i} className="px-4 py-2.5 text-zinc-400">{c}</td>)}</tr>)}</tbody>
      </table>
      {t.note && <figcaption className="border-t border-white/[.07] px-4 py-2 text-xs text-zinc-500">{t.note}</figcaption>}
    </figure>
  );
}

export function PrevNext({ page }: { page: DocPage }) {
  const prev = DOC_PAGES[page.n - 2], next = DOC_PAGES[page.n];
  return (
    <div className="flex justify-between gap-3 border-t border-white/[.07] pt-5 text-sm">
      {prev ? <Link href={`/docs/${prev.slug}`} className="flex items-center gap-1.5 text-zinc-400 hover:text-white"><ArrowLeft size={14} aria-hidden />{prev.tab}</Link> : <span />}
      {next && <Link href={`/docs/${next.slug}`} className="flex items-center gap-1.5 text-zinc-400 hover:text-white">{next.tab}<ArrowRight size={14} aria-hidden /></Link>}
    </div>
  );
}
