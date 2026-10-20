import { db } from "@/lib/db";
import { createPost, listPosts } from "@/lib/docs/posts";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ posts: await listPosts(db) });
}

export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 16_000) return Response.json({ error: "body too large" }, { status: 413 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }); }
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const r = await createPost(db, body, ip);
  if (!r.ok) return Response.json(r, { status: r.status, headers: r.status === 429 ? { "Retry-After": "600" } : undefined });
  return Response.json({ post: r.post }, { status: 201 });
}
