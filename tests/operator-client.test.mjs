import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describeAuthError, getOperatorToken, operatorHeaders, setOperatorToken, TOKEN_KEY } from "../src/lib/operator-client.ts";

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };

test("token is stored in the given session store and attached as x-operator-token", () => {
  const s = mem();
  assert.deepEqual(operatorHeaders(s), {});
  setOperatorToken("  abc  ", s);
  assert.equal(s.m.get(TOKEN_KEY), "abc");
  assert.deepEqual(operatorHeaders(s), { "x-operator-token": "abc" });
  setOperatorToken("", s);
  assert.equal(getOperatorToken(s), "");
  assert.deepEqual(operatorHeaders(s), {});
});

test("no store (SSR) means no header and no throw", () => {
  assert.deepEqual(operatorHeaders(null), {});
});

test("auth errors map to clear messages", () => {
  assert.match(describeAuthError(503, { code: "OPERATOR_TOKEN_NOT_CONFIGURED" }), /not set on the server/);
  assert.match(describeAuthError(401, { code: "OPERATOR_TOKEN_REQUIRED" }), /Operator token missing or wrong/);
  assert.match(describeAuthError(429, {}), /Rate limited/);
  assert.equal(describeAuthError(500, {}), null);
  assert.equal(describeAuthError(404, {}), null);
});

function walk(d, out = []) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(tsx?|mjs)$/.test(f)) out.push(p); } return out; }

test("client code never embeds the operator token or uses localStorage for it", () => {
  for (const f of walk("src")) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /NEXT_PUBLIC_[A-Z_]*TOKEN/, f);
    if (s.includes('"use client"') || f.includes("operator-client")) {
      assert.doesNotMatch(s, /process\.env\.HELLO_OPERATOR_TOKEN/, f);
      if (s.includes(TOKEN_KEY)) assert.doesNotMatch(s, /localStorage/, f);
    }
  }
  assert.match(readFileSync("src/lib/operator-client.ts", "utf8"), /sessionStorage/);
});

test("dashboard fetch helpers attach operator headers", () => {
  const uf = readFileSync("src/components/hello/use-fetch.ts", "utf8");
  assert.ok((uf.match(/operatorHeaders\(\)/g) || []).length >= 3);
  assert.match(readFileSync("src/components/ops/ops-fetch.ts", "utf8"), /operatorHeaders\(\)/);
});
