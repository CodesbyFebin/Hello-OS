import type { Metadata } from "next";
import Link from "next/link";
import { DOC_PAGES } from "@/lib/docs/content";
import { softwareApplication } from "@/lib/docs/jsonld";
import { DocsSidebar, JsonLd, SITE_URL } from "@/components/docs/docs-ui";

export const dynamic = "force-static";

const description = "Ten question-and-answer pages explaining HELLO OS, with every feature marked implemented, prototype or vision based on what exists in the repo.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "HELLO OS docs: 10-page explainer",
  description,
  alternates: { canonical: "/docs" },
  openGraph: { title: "HELLO OS docs", description, type: "website", url: "/docs", siteName: "HELLO OS" },
  twitter: { card: "summary", title: "HELLO OS docs", description },
};

export default function DocsIndex() {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8 lg:grid-cols-[240px_1fr]">
      <JsonLd data={softwareApplication(SITE_URL)} />
      <aside><DocsSidebar /></aside>
      <main className="space-y-6">
        <header>
          <div className="font-mono text-[10px] tracking-[.18em] text-zinc-500">HELLO OS // DOCS</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">How HELLO OS works, page by page</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">{description} No benchmark figures are claimed. Credits (H) are prototype units with no monetary value.</p>
        </header>
        <ol className="grid gap-3 md:grid-cols-2">
          {DOC_PAGES.map((p) => (
            <li key={p.slug}>
              <Link href={`/docs/${p.slug}`} className="block h-full rounded-xl border border-white/[.07] bg-[#0f1019]/80 p-4 hover:border-[#43e6a5]/40">
                <div className="font-mono text-[10px] tracking-[.18em] text-zinc-500">PAGE {String(p.n).padStart(2, "0")} · {p.tab.toUpperCase()}</div>
                <h2 className="mt-1.5 font-medium text-zinc-100">{p.question}</h2>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-zinc-500">{p.answer}</p>
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
