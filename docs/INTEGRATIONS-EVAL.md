# Integrations evaluation: evaluation tools

> PR #35 (`feat/integrations-eval`) also creates `docs/INTEGRATIONS-EVAL.md` for the Open-Source-Ai review. This branch is stacked on #34, so it adds the file with only the Stax section. Whichever PR merges second should keep both sections.

## Google Stax

Inspected `https://github.com/google-labs-code/stax` at commit `b3d47c8` (last commit 2026-09-15). The clone had 17 commits.

| Question | Finding |
| --- | --- |
| What it is | A self-hosted platform for evaluating LLM apps: datasets, model runs, human ratings and LLM evaluators, with a web UI. Formerly "Evaluable AI". |
| License | Apache-2.0. Compatible with HELLO's MIT license. We copy no Stax code or data. |
| Language and packaging | Java 17 Spring Boot backend (Maven, MySQL 8, GCP Pub/Sub), Next.js frontend, and Terraform for GCP (Cloud Run, Cloud SQL, Pub/Sub). It is not an npm or pip package and has no CLI. |
| Maturity | Early: 17 commits in the clone and no tagged release in the repo. The README badges point to `google/stax` and a placeholder OpenSSF project id. |
| Account, key or network | The documented setup needs a GCP project with billing (Terraform) or a local MySQL plus the gcloud Pub/Sub emulator. LLM evaluators and model runs call hosted providers (Gemini, OpenAI, Anthropic strategies are in the code), so those need API keys. |
| HELLO requirement | Evaluation (#34). Its useful overlap is human rating and LLM-judge review of the same cases HELLO grades deterministically. |
| Verdict | **Format-only adapter.** Running Stax itself is too heavy and cloud-oriented for HELLO's offline core path, so HELLO does not depend on it. HELLO only reads and writes the CSV shapes Stax uses, so a team that already runs Stax can rate HELLO cases there. |

### What was built (`src/lib/eval/stax.ts`, `scripts/stax.mjs`)

Status: **built and tested offline. Not verified against a running Stax instance**: no upload into Stax and no export out of Stax.

- **Export.** Writes a HELLO suite, plus the outputs of one offline run if you supply them, as a Stax dataset CSV with these columns: `system_instruction, input, expected_output, output, hello_case_id, hello_required, hello_grader, hello_passed`.
  - Column names follow Stax's dataset upload request (input, output and expected-output columns, chosen by name at upload).
  - The grader is exported verbatim, and `expected_output` is a readable description of it.
  - A run from a different suite version is refused (suiteHash mismatch).
- **Import.** Reads a Stax chat export CSV. Column names follow Stax's `ChatExportDTO`: `system_instruction, input, …, human_evaluation, human_evaluation_notes, output, inference_analytics, llm_evaluations, …`.
  - Rows are matched to HELLO cases by `hello_case_id` when present, otherwise by exact input text.
  - Returns advisory annotations: the human rating, the notes, and the LLM evaluator scores as exported. Rows that don't match a case are listed.
- **Source of truth.** HELLO run records stay the source of truth. Import never changes a run, a summary, or the promotion gate, and a test checks this.
- **Dependencies.** None. The adapter has no network calls and needs no Google account.

```bash
# Export the core suite with offline fixture outputs (upload this file in Stax as a dataset)
node --experimental-strip-types --import ./tests/register.mjs scripts/stax.mjs export --suite hello-core --fixture good > hello-core.stax.csv
# Read a Stax chat export as advisory annotations
node --experimental-strip-types --import ./tests/register.mjs scripts/stax.mjs import --suite hello-core --file stax-export.csv
npm run test:stax
```

### Off by default / how to disable

Nothing in the app, the API or the promotion flow calls the adapter. It runs only when someone runs `scripts/stax.mjs` by hand. There is no env var to set or unset. To remove it, delete `src/lib/eval/stax.ts`, `scripts/stax.mjs`, `tests/stax-adapter.test.mjs`, `tests/fixtures/stax/`, and the `test:stax` script in `package.json`.

### Gaps

- Not run against a real Stax deployment. Column names come from reading Stax's source (`DataSetCsvUploadRequest`, `ChatExportDTO`).
- The parser was checked against Stax's bundled `server/src/main/resources/sample-data.csv`: 14 rows, 11 columns, every `llm_evaluations` cell is valid JSON. That file is not copied into this repo.
- Stax's JSON import path and side-by-side (SxS) exports are not handled.
- Matching by input text breaks if a prompt is edited in Stax and `hello_case_id` was dropped. Such rows are reported as unmatched.
