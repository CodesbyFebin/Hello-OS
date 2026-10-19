import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { OpsFrame, opsCard } from "@/components/ops/ops-frame";

export const dynamic = "force-static";
export const metadata = { title: "Ops | HELLO OS" };

type Meta = { title: string; summary: string; order?: number };

// Each ops panel ships a meta.json next to its page, so panels added in
// separate PRs show up here without editing this file.
function panels() {
  const dir = path.join(process.cwd(), "src/app/ops");
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "meta.json")))
    .map((d) => ({ slug: d.name, ...(JSON.parse(fs.readFileSync(path.join(dir, d.name, "meta.json"), "utf8")) as Meta) }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export default function OpsIndex() {
  return (
    <OpsFrame title="Ops console" subtitle="Operator tools for this HELLO OS instance. Everything here reads and writes the local prototype database; credits are prototype credits, not money.">
      <div className="grid gap-3 sm:grid-cols-2">
        {panels().map((p) => (
          <Link key={p.slug} href={`/ops/${p.slug}`} className={`${opsCard} block hover:border-white/20`}>
            <b className="text-white">{p.title}</b>
            <p className="mt-1 text-xs text-zinc-400">{p.summary}</p>
          </Link>
        ))}
      </div>
    </OpsFrame>
  );
}
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { OpsFrame, opsCard } from "@/components/ops/ops-frame";

export const dynamic = "force-static";
export const metadata = { title: "Ops | HELLO OS" };

type Meta = { title: string; summary: string; order?: number };

// Each ops panel ships a meta.json next to its page, so panels added in
// separate PRs show up here without editing this file.
function panels() {
  const dir = path.join(process.cwd(), "src/app/ops");
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "meta.json")))
    .map((d) => ({ slug: d.name, ...(JSON.parse(fs.readFileSync(path.join(dir, d.name, "meta.json"), "utf8")) as Meta) }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export default function OpsIndex() {
  return (
    <OpsFrame title="Ops console" subtitle="Operator tools for this HELLO OS instance. Everything here reads and writes the local prototype database; credits are prototype credits, not money.">
      <div className="grid gap-3 sm:grid-cols-2">
        {panels().map((p) => (
          <Link key={p.slug} href={`/ops/${p.slug}`} className={`${opsCard} block hover:border-white/20`}>
            <b className="text-white">{p.title}</b>
            <p className="mt-1 text-xs text-zinc-400">{p.summary}</p>
          </Link>
        ))}
      </div>
    </OpsFrame>
  );
}
