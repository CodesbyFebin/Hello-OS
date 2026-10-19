// Failure library: parse build/test logs into normalised failure signatures,
// count recurrences, and retrieve similar past failures (and their fixes).
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { cosine, vectorize } from "@/lib/similarity";

export type ParsedFailure = { source: string; message: string; location: string; signature: string };

const PATTERNS: { source: string; re: RegExp }[] = [
  { source: "build", re: /^([^\s(]+\.[cm]?[jt]sx?)\((\d+),(\d+)\): error (TS\d+: .+)$/ }, // tsc
  { source: "build", re: /^([^\s:]+\.[cm]?[jt]sx?):(\d+):(\d+)\s+error\s+(.+)$/ }, // eslint unix-ish
  { source: "test", re: /^not ok \d+ - (.+)$/ }, // TAP / node:test
  { source: "runtime", re: /^((?:[A-Z][a-zA-Z]*Error|Error): .+)$/ },
];

/** Strip volatile bits (numbers, quoted values, hex, paths) so recurrences share a signature. */
export function normalizeMessage(msg: string): string {
  return msg.replace(/'[^']*'|"[^"]*"/g, "'…'").replace(/0x[0-9a-f]+/gi, "0x…").replace(/\b\d+\b/g, "N").replace(/\s+/g, " ").trim();
}

export function parseLog(log: string, defaultSource = "build"): ParsedFailure[] {
  const out = new Map<string, ParsedFailure>();
  for (const raw of log.split(/\r?\n/).slice(0, 5000)) {
    const line = raw.trim();
    for (const p of PATTERNS) {
      const m = line.match(p.re);
      if (!m) continue;
      const hasLoc = m.length > 2;
      const message = (hasLoc ? m[4] : m[1]).slice(0, 500);
      const source = p.source === "runtime" ? defaultSource : p.source;
      const signature = createHash("sha256").update(`${source}|${normalizeMessage(message)}`).digest("hex");
      out.set(signature, { source, message, location: hasLoc ? `${m[1]}:${m[2]}` : "", signature });
      break;
    }
  }
  return [...out.values()];
}

export async function ingest(log: string, source = "build") {
  const parsed = parseLog(log, source);
  const now = new Date();
  for (const f of parsed) {
    await db.failureRecord.upsert({
      where: { signature: f.signature },
      update: { count: { increment: 1 }, lastSeen: now, message: f.message, location: f.location },
      create: { source: f.source, signature: f.signature, message: f.message, location: f.location },
    });
  }
  return parsed;
}

/** Retrieve the most similar recorded failures for a new error message. */
export async function similar(query: string, limit = 5) {
  const qv = vectorize(normalizeMessage(query));
  const all = await db.failureRecord.findMany({ orderBy: { lastSeen: "desc" }, take: 1000 });
  return all.map((f) => ({ ...f, score: Number(cosine(qv, vectorize(normalizeMessage(f.message))).toFixed(3)) }))
    .filter((f) => f.score > 0.2).sort((a, b) => b.score - a.score).slice(0, limit);
}
