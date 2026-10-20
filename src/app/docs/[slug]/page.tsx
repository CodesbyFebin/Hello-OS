import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileJson, FileText } from "lucide-react";
import { DOC_PAGES, getDocPage } from "@/lib/docs/content";
import { softwareApplication, techArticle } from "@/lib/docs/jsonld";
import { DirectAnswer, DocTable, DocsSidebar, FeatureList, JsonLd, PrevNext, SITE_URL } from "@/components/docs/docs-ui";
import { AmlPreview } from "@/components/hello/aml-preview";
import { UgcBoard } from "@/components/docs/ugc-board";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = getDocPage((await params).slug);
  if (!p) return {};
  const title = `${p.title} · HELLO OS docs`;
  return {
    metadataBase: new URL(SITE_URL),
    title, description: p.description,
    alternates: { canonical: `/docs/${p.slug}` },
    openGraph: { title, description: p.description, type: "article", url: `/docs/${p.slug}`, siteName: "HELLO OS", section: p.tab },
    twitter: { card: "summary", title, description: p.description },
  };
}

function Discovery() {
  const items = [
    { href: "/llms.txt", label: "/llms.txt", desc: "Plain-text briefing for LLMs, with the routes this app serves.", Icon: FileText },
    { href: "/.well-known/agent-card.json", label: "/.well-known/agent-card.json", desc: "A2A agent card, including the docs pages and route list.", Icon: FileJson },
  ];
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((i) => (
        <li key={i.href}><a href={i.href} className="flex h-full gap-3 rounded-xl border border-white/[.07] bg-[#0f1019]/80 p-4 hover:border-[#43e6a5]/40">
          <i.Icon size={18} className="mt-0.5 text-[#43e6a5]" aria-hidden />
          <span><span className="block font-mono text-sm text-zinc-100">{i.label}</span><span className="text-xs text-zinc-500">{i.desc}</span></span>
        </a></li>
      ))}
    </ul>
  );
}

export default async function DocPageView({ params }: { params: Promise<{ slug: string }> }) {
  const p = getDocPage((await params).slug);
  if (!p) notFound();
  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8 lg:grid-cols-[240px_1fr]">
      <JsonLd data={p.n === 1 ? [techArticle(SITE_URL, p), softwareApplication(SITE_URL)] : techArticle(SITE_URL, p)} />
      <aside className="hidden lg:block"><DocsSidebar current={p.slug} /></aside>
      <main className="min-w-0 space-y-6">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] tracking-[.18em] text-zinc-500"><Link href="/docs" className="hover:text-white">DOCS</Link> / PAGE {String(p.n).padStart(2, "0")} OF {DOC_PAGES.length}</nav>
        <article className="space-y-6">
          <DirectAnswer question={p.question} answer={p.answer} />
          {p.sections.map((s) => (
            <section key={s.heading} className="space-y-2">
              <h2 className="text-lg font-semibold text-white">{s.heading}</h2>
              {s.body.map((b) => <p key={b.slice(0, 40)} className="text-sm leading-relaxed text-zinc-400">{b}</p>)}
              {s.code && <figure className="rounded-xl border border-white/[.07] bg-black/40"><figcaption className="border-b border-white/[.07] px-4 py-2 font-mono text-[10px] tracking-wider text-zinc-500">{s.code.label.toUpperCase()}</figcaption><pre className="overflow-x-auto p-4 font-mono text-xs text-zinc-300">{s.code.text}</pre></figure>}
            </section>
          ))}
          {p.tables?.map((t) => <DocTable key={t.caption} t={t} />)}
          {p.widget === "aml" && <section aria-label="Live AML compile preview" className="docs-aml"><AmlPreview /></section>}
          {p.widget === "ugc" && <UgcBoard />}
          {p.widget === "discovery" && <Discovery />}
          <FeatureList features={p.features} />
        </article>
        <details className="rounded-xl border border-white/[.07] p-3 text-sm text-zinc-400 lg:hidden"><summary className="cursor-pointer text-zinc-200">All docs pages</summary><div className="mt-3"><DocsSidebar current={p.slug} /></div></details>
        <PrevNext page={p} />
      </main>
    </div>
  );
}
