// GitAgentHUB field reports for /docs. Validated with zod, receipted with a
// server-side SHA-256 hash, rate limited per hashed client key.
import { createHash } from "node:crypto";
import { z } from "zod";

export const POST_RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 };

const clean = (max: number, min = 1) =>
  z.string().transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim()).pipe(z.string().min(min).max(max));

export const postInput = z.object({
  author: clean(60, 2),
  title: clean(140, 4),
  body: clean(4000, 20),
  repo: z.string().trim().max(120).regex(/^[\w.\-/]*$/, "repo may only contain letters, digits, . _ - /").optional().default(""),
}).strict();

export type PostInput = z.infer<typeof postInput>;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function receiptFor(p: { author: string; title: string; body: string; repo: string; createdAt: Date }) {
  return sha256(JSON.stringify({ v: 1, author: p.author, title: p.title, body: p.body, repo: p.repo, createdAt: p.createdAt.toISOString() }));
}

export const clientKeyFor = (ip: string) => sha256(`docs-post:${ip || "unknown"}`);

type Db = typeof import("../db")["db"];
const publicFields = { id: true, author: true, title: true, body: true, repo: true, receipt: true, createdAt: true } as const;

export async function listPosts(db: Db, limit = 50) {
  return db.docsPost.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: publicFields });
}

export async function createPost(db: Db, raw: unknown, ip: string, now = new Date()) {
  const parsed = postInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: "invalid post", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  }
  const clientKey = clientKeyFor(ip);
  const recent = await db.docsPost.count({ where: { clientKey, createdAt: { gt: new Date(now.getTime() - POST_RATE_LIMIT.windowMs) } } });
  if (recent >= POST_RATE_LIMIT.max) {
    return { ok: false as const, status: 429, error: `rate limited: at most ${POST_RATE_LIMIT.max} posts per ${POST_RATE_LIMIT.windowMs / 60000} minutes` };
  }
  const data = { ...parsed.data, createdAt: now };
  const post = await db.docsPost.create({ data: { ...data, receipt: receiptFor(data), clientKey }, select: publicFields });
  return { ok: true as const, status: 201, post };
}
