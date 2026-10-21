// Optional Google Stax format adapter. Off by default: nothing in the app calls it.
// Offline only; it reads and writes files and never contacts Stax or Google.
//   Export a suite (plus offline fixture outputs) as a Stax dataset CSV:
//     node --experimental-strip-types --import ./tests/register.mjs scripts/stax.mjs export --suite hello-core [--fixture good] > hello-core.stax.csv
//   Read a Stax chat export CSV as advisory annotations (JSON on stdout):
//     node --experimental-strip-types --import ./tests/register.mjs scripts/stax.mjs import --suite hello-core --file export.csv
import { readFileSync } from "node:fs";
const { exportSuiteCsv, importStaxCsv } = await import("../src/lib/eval/stax.ts");
const { SUITES } = await import("../src/lib/eval/suites.ts");
const { runSuite, fixtureModel } = await import("../src/lib/eval/core.ts");

const [cmd] = process.argv.slice(2);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const suite = SUITES[arg("--suite", "hello-core")];
if (!suite) { console.error("unknown suite"); process.exit(1); }

if (cmd === "export") {
  const fx = arg("--fixture");
  if (!fx) { process.stdout.write(exportSuiteCsv(suite)); process.exit(0); }
  const outputs = JSON.parse(readFileSync(new URL(`../tests/fixtures/eval/${fx}.json`, import.meta.url), "utf8"));
  const run = await runSuite(suite, { id: `fixture:${fx}`, revision: "local", promptVersion: suite.version, provider: "fixture", model: `fixture/${fx}`, config: { offline: true } }, fixtureModel(outputs));
  process.stdout.write(exportSuiteCsv(suite, { run, outputs }));
} else if (cmd === "import") {
  const file = arg("--file");
  if (!file) { console.error("--file required"); process.exit(1); }
  console.log(JSON.stringify(importStaxCsv(readFileSync(file, "utf8"), suite), null, 2));
} else {
  console.error("usage: stax.mjs export|import --suite <id> [--fixture <name>] [--file <csv>]");
  process.exit(1);
}
