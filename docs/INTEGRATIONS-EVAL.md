# Open-Source-Ai candidates vs HELLO OS requirements

Evaluated 2026-10-21 against HELLO OS `main` @ `972b3e9` and
[CodesbyFebin/Open-Source-Ai](https://github.com/CodesbyFebin/Open-Source-Ai) `main` @ `15a7ccf`.

**Catalog state checked first:** `.gitmodules` and 70 submodule (gitlink) entries now exist under
`stacks/`. That is newer than the earlier review that found none. `catalog.json` is dated 2026-10-20.
HELLO OS vendors none of them: they're upstream projects with their own licenses (some are not MIT,
for example Trylon Gateway is BUSL-1.1). HELLO only talks to them over network protocols it already
speaks.

**Adoption rule:** adopt only if it serves a named HELLO requirement, is disabled by default, has an
offline test, a documented disable path, and adds no dependency to the base install.

| Catalog area (examples) | HELLO OS requirement it would serve | Current HELLO code that covers it | Verdict | Reason |
| --- | --- | --- | --- | --- |
| Local models (Ollama; also llama.cpp server, LocalAI, llamafile) | Local-first AI with no cloud account or key | `src/lib/ai/provider.ts` (OpenAI-compatible `chat`) | **Adopt: `ollama` provider profile** | It's one entry in `PROVIDERS` plus "key optional, model required". No new dependency, off unless `HELLO_AI_PROVIDER=ollama`, offline test in `tests/ollama-gateway-profile.test.mjs`. Other OpenAI-compatible local servers work through `custom`. |
| Gateways (LiteLLM, Bifrost, Portkey) | Routing/fallback across providers behind one endpoint | `custom` provider + `HELLO_AI_BASE_URL`; retries and 429 handling in `chat()` | **Adopt: docs + test only** | It already works through `custom`. The test proves bearer forwarding and that the key stays out of `aiStatus`. No code or dependency added. |
| Gateways (FreeLLMAPI, OpenCode Free Router, Trylon) | Same as above | Same | Defer | Free-tier aggregators route to third parties with unclear data handling. Trylon is BUSL-1.1. If needed, they're usable through `custom`, but not recommended. |
| Eval / observability (promptfoo, DeepEval, Langfuse, Phoenix) | Promotion based on measured task results; traces | `src/lib/eval/*` (PR #34), `Trace` and `AuditLog` models, `ai.call` audit rows | Defer | HELLO's own eval loop is the source of truth and runs offline. A Langfuse/Phoenix export adapter needs a redaction design and a fake-collector test first. Revisit once suites grow. |
| Memory (Mem0, OpenMemory, Letta, Graphiti) | Agent memory, role-scoped recall | `CortexMemory`, `src/lib/knowledge.ts` (filters by role before ranking) | Defer | No failing quality, scale or isolation test shows Cortex is insufficient. An external store would also have to preserve role filtering. |
| RAG / vector DBs (Qdrant, Chroma, Milvus, Weaviate, LlamaIndex, Haystack, RAGFlow) | Document retrieval at scale | `knowledge.ts`, `semantic-cache.ts`, `similarity.ts` (local trigram cosine) | Defer | No realistic-corpus benchmark exists yet. Add a vector backend only once one shows the local approach failing. |
| Agent frameworks (LangChain, LangGraph, CrewAI, AutoGen, smolagents, Agno, OpenHuman) | Scheduling and delegation | `scheduler.ts`, `delegation.ts`, approval gate `gate.ts` | Reject (for now) | A second control plane would bypass the wallet caps and approval gate. There's no concrete use case or interoperability test. |
| Coding agents (OpenHands, Aider, Continue, OpenCode, Cline) | Agent-proposed code changes | `forge.ts`, `CodeMutation`, Wasm `sandbox.ts` | Reject | These need repo writes and command execution. HELLO's policy is that agent code is untrusted and changes come as human-reviewed patches. |
| Code review (PR-Agent, Open Code Review) | Review of agent patches | None (human review) | Defer | It would post to GitHub (an external side effect). Consider it only as an advisory, approval-gated tool. |
| Inference serving (vLLM, SGLang, TGI, Triton) | High-throughput self-hosted inference | `custom` provider | Defer | These are OpenAI-compatible, so they already work via `custom`. They need GPUs and aren't part of local quickstart. |
| Chat UI / app builders (Open WebUI, LibreChat, Dify, Flowise, Langflow, n8n) | None identified | HELLO's own Next.js UI | Reject | Overlap with the HELLO UI and no requirement they serve. |
| Backend infra (Supabase, PocketBase, Butterbase) | Hosted persistence | Prisma + SQLite/Turso (`db-config.ts`) | Reject | Turso was already chosen for Vercel. A second database layer adds risk with no gain. |
| App templates / CodesbyFebin collection | None identified | — | Reject | Not runtime components. |

## What was adopted

1. **`ollama` provider profile** (`src/lib/ai/provider.ts`):
   - Default base URL `http://127.0.0.1:11434/v1`.
   - `HELLO_AI_API_KEY` is optional; when it's empty, no `Authorization` header is sent.
   - `HELLO_AI_MODEL` is required, because the hosted default model won't exist locally.
2. **LiteLLM/Bifrost gateway recipe**: documentation only, through the existing `custom` provider.

Neither was benchmarked. No latency or quality numbers are claimed.

### Enable

```bash
# Ollama (after `ollama pull <model>`)
HELLO_AI_PROVIDER=ollama
HELLO_AI_MODEL=<model you pulled>
# optional: HELLO_AI_BASE_URL=http://host:11434/v1

# LiteLLM proxy (or Bifrost) as a gateway
HELLO_AI_PROVIDER=custom
HELLO_AI_BASE_URL=http://127.0.0.1:4000/v1
HELLO_AI_API_KEY=<gateway virtual key>
HELLO_AI_MODEL=<model name as the gateway exposes it>
```

### Disable / remove

Unset `HELLO_AI_PROVIDER`. AI routes then return `503 NO_AI_PROVIDER`. Nothing else depends on either profile.

### Data handling

- **Ollama:** prompts go only to the configured base URL, which is loopback by default. If you point it at another host, prompts go to that host.
- **Gateways:** prompts go to the gateway and then to whatever upstreams it's configured for. Review its logging settings.
- The key lives only in env. It is never stored in Prisma, returned by `aiStatus`, or written to audit rows (those store hashes and the model name).

### Tests

`tests/ollama-gateway-profile.test.mjs` runs against a local mock server with no network:
- disabled by default
- Ollama URL, optional key and required model
- no auth header without a key
- gateway bearer forwarding, with the key kept out of status

Not tested against a real Ollama or LiteLLM install.

---

## Evaluation tools

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
