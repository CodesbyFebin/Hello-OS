// Design tokens: WCAG contrast math and the token values used in globals.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ratio, TOKENS, CONTRAST, ALIASES } from "../src/lib/design/contrast.ts";

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

test("design-guide aliases point at existing tokens via var() and add no new colors", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  for (const [a, canon] of Object.entries(ALIASES)) {
    assert.ok(TOKENS[canon], `${a} -> unknown ${canon}`);
    assert.ok(css.includes(`--color-${a}: var(--hello-${canon});`), a);
  }
  assert.ok(!/--hello-(cognition|economy|society|evolution)/.test(css), "aliases must not define new --hello-* colors");
});

test("default alias shades meet AA on void and panel", () => {
  for (const a of ["cognition", "economy", "society", "evolution", "soul"])
    for (const bg of ["void", "panel"]) assert.ok(ratio(TOKENS[ALIASES[a]], TOKENS[bg]) >= 4.5, `${a} on ${bg}`);
});
