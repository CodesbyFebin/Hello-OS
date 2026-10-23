// Truth-pass guard: no Math.random in API routes or product components, no
// hard-coded demo residents in the dashboard, and the handshake version comes
// from package.json.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// sidebar.tsx is the shadcn skeleton width (cosmetic, not data).
const ALLOW = new Set([join("src", "components", "ui", "sidebar.tsx")]);

test("no Math.random() calls in src (except cosmetic skeleton widths)", () => {
  const offenders = walk("src")
    .filter((f) => !ALLOW.has(f))
    .filter((f) => /Math\.random\(\)/.test(readFileSync(f, "utf8").replace(/<code[^>]*>Math\.random\(\)<\/code>/g, "")));
  assert.deepEqual(offenders, []);
});

test("dashboard has no hard-coded resident agents", () => {
  const src = readFileSync("src/components/hello/dashboard.tsx", "utf8");
  for (const fake of ["did:key:z6MkvAtlas", "Mira", "Sentry", "rcpt_7ec1a2"]) assert.ok(!src.includes(fake), fake);
});

test("handshake version is read from package.json", () => {
  const src = readFileSync("mini-services/hello-mcp/index.ts", "utf8");
  assert.ok(!/version:\s*"1\.0\.0"/.test(src));
  assert.match(JSON.parse(readFileSync("package.json", "utf8")).version, /^0\.2\./);
});

test("duplicate lowercase agents.md / llm.txt are gone", () => {
  assert.ok(!readdirSync(".").includes("agents.md"));
  assert.ok(!existsSync("llm.txt"));
});

test("no unmeasured 'CI <200ms' claim", () => {
  assert.ok(!walk("src").some((f) => /&lt;200ms|<200ms/.test(readFileSync(f, "utf8"))));
});

test("cloud.checkpoint/rollback MCP tools are labelled simulations, not real restores", async () => {
  const src = readFileSync("src/lib/mcp/server.ts", "utf8");
  assert.ok(!src.includes("Restores the DB + FS snapshot atomically"));
  assert.equal((src.match(/description: "SIMULATION:/g) || []).length >= 2, true);
});

test("capability matrix exists, names a verified commit, and labels simulations", () => {
  const m = readFileSync("docs/CAPABILITIES.md", "utf8");
  assert.match(m, /Last verified:\*\* `main` @ `[0-9a-f]{7}`/);
  assert.match(m, /\*\*simulation\*\*/);
  assert.match(m, /Firecracker[^|]*\| \*\*planned \/ vision\*\*/);
});

test("UI uses the HELLO OS name, not the old 'Agent Commons' label", () => {
  const offenders = [...walk(join("src", "app")), ...walk(join("src", "components"))]
    .filter((f) => readFileSync(f, "utf8").includes("Agent Commons"));
  assert.deepEqual(offenders, []);
});

test("evolution gene scoring is marked as a simulation in source", () => {
  assert.match(readFileSync("src/lib/evolution.ts", "utf8"), /SIMULATION ONLY/);
});
