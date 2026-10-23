import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticate, guardWrite, idempotent, principalScope, rateLimit, clientKey } from "@/lib/guard";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const requestedTier = searchParams.get("tier")?.toUpperCase();
  const tierAlias: Record<string, string[]> = { CORE: ["CORE", "RAM"], RAM: ["CORE", "RAM"], RECALL: ["RECALL", "STORE"], STORE: ["RECALL", "STORE"], ARCHIVE: ["ARCHIVE"] };
  const tiers = requestedTier ? tierAlias[requestedTier] : undefined;
  const kind = searchParams.get("kind");
  const temporal = searchParams.get("temporal");
  const query = searchParams.get("q")?.trim().toLowerCase();
  const maxTokens = Math.min(Math.max(Number(searchParams.get("maxTokens") || 1500), 1), 10000);

  let where: any = { agentId: id };
  if (tiers) where.tier = { in: tiers };
  if (kind) where.kind = kind;
  if (!temporal) where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  if (temporal) {
    const t = new Date(temporal);
    if (!Number.isFinite(t.getTime())) return NextResponse.json({ error: "temporal must be a valid ISO date" }, { status: 400 });
    where.AND = [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: t } }] },
      { validFrom: { lte: t } },
      { OR: [{ validTo: null }, { validTo: { gt: t } }] },
    ];
  }

  let memories = await db.memory.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: query ? 300 : 100,
  });

  let tokensUsed: number | undefined;
  if (query) {
    const terms = [...new Set(query.split(/\W+/).filter((term) => term.length > 2))];
    memories = memories.map((memory) => {
      const text = `${memory.content} ${memory.tags} ${memory.kind}`.toLowerCase();
      return { ...memory, relevance: terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) };
    }).filter((memory) => memory.relevance > 0).sort((a, b) => b.relevance - a.relevance || b.updatedAt.getTime() - a.updatedAt.getTime());
    let remaining = maxTokens;
    memories = memories.filter((memory) => {
      const estimate = Math.max(1, Math.ceil(memory.content.length / 4));
      if (estimate > remaining) return false;
      remaining -= estimate;
      return true;
    });
    tokensUsed = maxTokens - remaining;
  }

  const [core, recall, archive] = await Promise.all([
    db.memory.count({ where: { agentId: id, tier: { in: ["CORE", "RAM"] } } }),
    db.memory.count({ where: { agentId: id, tier: { in: ["RECALL", "STORE"] } } }),
    db.memory.count({ where: { agentId: id, tier: "ARCHIVE" } }),
  ]);

  return NextResponse.json({ memories, ...(tokensUsed !== undefined ? { retrieval: { query, budgetTokens: maxTokens, tokensUsed } } : {}), summary: { core, recall, archive, total: core + recall + archive, aliases: { RAM: "CORE", STORE: "RECALL" } } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardWrite(req, { bucket: "memory", agents: [id] });
  if (!g.ok) return g.response;
  return idempotent(req, `memory:${id}:${principalScope(g.principal)}`, g.text, async () => {
  const { content, tier, kind, confidence, ttl, tags, provenance } = g.json;
  if (typeof content === "string" && content.length > 20_000) return NextResponse.json({ error: "content must be at most 20000 characters" }, { status: 400 });
  if (tags !== undefined && (typeof tags !== "string" || tags.length > 500)) return NextResponse.json({ error: "tags must be a string of at most 500 characters" }, { status: 400 });
  if (kind !== undefined && (typeof kind !== "string" || kind.length > 40)) return NextResponse.json({ error: "kind must be a string of at most 40 characters" }, { status: 400 });
  if (provenance !== undefined && (typeof provenance !== "string" || provenance.length > 200)) return NextResponse.json({ error: "provenance must be a string of at most 200 characters" }, { status: 400 });
  if (confidence !== undefined && (typeof confidence !== "number" || !(confidence >= 0 && confidence <= 1))) return NextResponse.json({ error: "confidence must be a number from 0 to 1" }, { status: 400 });
  const normalizedTier = String(tier || "RECALL").toUpperCase();
  const normalizedTtl = String(ttl || "permanent");
  if (typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });
  if (!["CORE", "RECALL", "ARCHIVE", "RAM", "STORE"].includes(normalizedTier)) return NextResponse.json({ error: "tier must be CORE, RECALL, or ARCHIVE" }, { status: 400 });
  if (!["permanent", "session", "7d", "30d"].includes(normalizedTtl)) return NextResponse.json({ error: "ttl must be permanent, session, 7d, or 30d" }, { status: 400 });

  const mem = await db.memory.create({
    data: {
      agentId: id,
      tier: normalizedTier === "RAM" ? "CORE" : normalizedTier === "STORE" ? "RECALL" : normalizedTier,
      kind: kind || "episodic",
      content: content.trim(),
      tags: tags || "",
      confidence: confidence ?? 0.8,
      provenance: provenance || "self",
      ttl: normalizedTtl,
      expiresAt: normalizedTtl === "session" ? new Date(Date.now() + 3600_000) : normalizedTtl === "7d" ? new Date(Date.now() + 7 * 86400_000) : normalizedTtl === "30d" ? new Date(Date.now() + 30 * 86400_000) : null,
      validFrom: new Date(),
    },
  });
  return NextResponse.json({ memory: mem });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authenticate(req, "", [id]);
  if (!auth.ok) return auth.response;
  const rl = await rateLimit("memory", clientKey(req, auth.principal), 120);
  if (!rl.ok) return rl.response;
  const { searchParams } = new URL(req.url);
  const memoryId = searchParams.get("memoryId");
  if (!memoryId) return NextResponse.json({ error: "memoryId required" }, { status: 400 });
  // Only this agent's memory: a memoryId from another agent is "not found".
  const del = await db.memory.deleteMany({ where: { id: memoryId.slice(0, 64), agentId: id } });
  if (!del.count) return NextResponse.json({ error: "memory not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
