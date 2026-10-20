// Design tokens: WCAG contrast math and the token values used in globals.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ratio, TOKENS, CONTRAST } from "../src/lib/design/contrast.ts";

test("contrast formula matches known values", () => {
  assert.equal(ratio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(ratio("#777777", "#ffffff").toFixed(2), "4.48");
});

test("globals.css defines every token with the same hex", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  for (const [k, v] of Object.entries(TOKENS)) if (!k.startsWith("zinc")) assert.ok(css.includes(`--hello-${k}: ${v};`), k);
});

test("accent and body text tokens meet AA on void and panel", () => {
  const mustPass = CONTRAST.filter((c) => !["soul-500", "zinc-500", "zinc-600"].includes(c.fg));
  for (const c of mustPass) assert.ok(c.ratio >= 4.5, `${c.fg} on ${c.bg} = ${c.ratio.toFixed(2)}`);
});
