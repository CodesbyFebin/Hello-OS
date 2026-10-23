// /docs portal: field-report API (zod validation, SHA-256 receipt, rate limit,
// text-only output) and discovery files generated from real routes.
// Run with a scratch DB: DATABASE_URL=file:/tmp/hello-docs.db npm run test:docs
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { db } from "../src/lib/db.ts";
import { createPost, listPosts, receiptFor, POST_RATE_LIMIT } from "../src/lib/docs/posts.ts";
import { buildLlmsTxt, docsCardExtension, ROUTES } from "../src/lib/docs/discovery.ts";
import { DOC_PAGES } from "../src/lib/docs/content.ts";
import * as postsRoute from "../src/app/api/docs/posts/route.ts";

before(() => db.docsPost.deleteMany());
after(() => db.$disconnect());

const good = { author: "tester", title: "Ran the AML compiler", body: "Compiled the sample mission and got a stable source hash." };

test("empty DB lists no posts", async () => {
  assert.deepEqual(await listPosts(db), []);
  const r = await postsRoute.GET();
  assert.deepEqual(await r.json(), { posts: [] });
});

test("validation rejects bad input with issues", async () => {
  for (const bad of [{}, { ...good, title: "x" }, { ...good, body: "short" }, { ...good, repo: "<script>" }, { ...good, extra: 1 }, { ...good, author: 5 }]) {
    const r = await createPost(db, bad, "1.1.1.1");
    assert.equal(r.ok, false); assert.equal(r.status, 400); assert.ok(r.issues.length > 0);
  }
  assert.equal(await db.docsPost.count(), 0);
});

test("stores text as-is with a verifiable server-side receipt and no client key", async () => {
  const html = { ...good, body: "<img src=x onerror=alert(1)> is stored as plain text" };
  const r = await createPost(db, html, "2.2.2.2");
  assert.equal(r.ok, true); assert.equal(r.status, 201);
  assert.equal(r.post.body, html.body);
  assert.match(r.post.receipt, /^[0-9a-f]{64}$/);
  assert.equal(r.post.receipt, receiptFor({ ...r.post, repo: "" }));
  assert.equal(receiptFor({ ...r.post, body: r.post.body + "!" }) === r.post.receipt, false);
  const [listed] = await listPosts(db);
  assert.equal(listed.id, r.post.id); assert.equal("clientKey" in listed, false);
});

test("rate limits per client after the window max", async () => {
  const ip = "3.3.3.3";
  for (let i = 0; i < POST_RATE_LIMIT.max; i++) assert.equal((await createPost(db, good, ip)).ok, true);
  const blocked = await createPost(db, good, ip);
  assert.equal(blocked.status, 429);
  assert.equal((await createPost(db, good, "4.4.4.4")).ok, true, "other clients unaffected");
  const later = new Date(Date.now() + POST_RATE_LIMIT.windowMs + 1000);
  assert.equal((await createPost(db, good, ip, later)).ok, true, "window expires");
});

test("POST route returns 201, 400 and 429 over HTTP semantics", async () => {
  const req = (body, ip = "5.5.5.5") => new Request("http://x/api/docs/posts", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body });
  assert.equal((await postsRoute.POST(req("not json"))).status, 400);
  assert.equal((await postsRoute.POST(req(JSON.stringify({ title: "x" })))).status, 400);
  for (let i = 0; i < POST_RATE_LIMIT.max; i++) assert.equal((await postsRoute.POST(req(JSON.stringify(good)))).status, 201);
  assert.equal((await postsRoute.POST(req(JSON.stringify(good)))).status, 429);
});

test("route manifest matches src/app and discovery lists real routes", () => {
  execFileSync(process.execPath, ["scripts/gen-route-manifest.mjs", "--check"], { stdio: "pipe" });
  const txt = buildLlmsTxt("https://example.test");
  for (const p of DOC_PAGES) assert.ok(txt.includes(`https://example.test/docs/${p.slug}`));
  assert.ok(txt.includes("GET,POST /api/docs/posts"));
  assert.ok(ROUTES.api.some((r) => r.path === "/llms.txt"));
  assert.ok(!/USDC|HLO|74%|446,000/.test(txt.split("## Docs")[1]));
  const card = docsCardExtension("https://example.test");
  assert.equal(card.docs.length, 11); assert.ok(card.pages.includes("/docs/[slug]"));
});

test("docs content uses honest labels and no unverified figures", () => {
  assert.equal(DOC_PAGES.length, 11);
  const all = JSON.stringify(DOC_PAGES);
  for (const bad of ["74%", "74.5", "50ms", "48ms", "8ms", "<35ms", "96%", "8x", "446,000", "18ms", "100/100", "847", "612", "architect-v4", "sentinel-sec", "USDC", "HLO", "$", "GPT-5", "Claude 4"]) assert.ok(!all.includes(bad), `found ${bad}`);
  for (const p of DOC_PAGES) for (const f of p.features) if (f.status === "implemented") assert.ok(f.href, `${f.name} needs a link`);
});
