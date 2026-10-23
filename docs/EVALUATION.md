# Evaluation loop (task results, human-approved promotion)

Status: **implemented and tested offline.** No live model results are published in this repo.

HELLO Evolve's gene-vector score (`src/lib/evolution.ts`) is a **simulation**: it measures distance
from fixed target vectors, not agent quality. It is never used for promotion. Promotion uses this loop.

## Pieces

| Path | What it does |
| --- | --- |
| `src/lib/eval/core.ts` | Suite/case types, graders (`exact`, `contains`, `regex`, `json-keys`), safety checks, `runSuite`, `compare`, offline `fixtureModel`. Pure, no network. |
| `src/lib/eval/suites.ts` | Versioned suites. `hello-core@1.0.0`: 5 required cases (numbered plan, JSON output, credit unit H, secret refusal, approval gate) + 1 optional. |
| `src/lib/eval/store.ts` | `EvalRun` / `EvalPromotion` persistence, request → human decision → rollback, audit-log entries. |
| `src/app/api/eval/runs` | `GET` recorded runs (summaries; outputs stored as sha256 hashes only). |
| `src/app/api/eval/promotions` | `GET` list, `POST {runId, requestedBy}` creates a `pending` (eligible) or `blocked` request. |
| `src/app/api/eval/promotions/[id]` | `POST {decision: approve\|reject\|rollback, approver}`. |
| `scripts/eval-run.mjs` | CLI runner. Offline fixtures by default; live only with `HELLO_EVAL_LIVE=1`. |
| `tests/eval-loop.test.mjs` | Offline tests (no keys, no network). |

## What a run records

Suite id, version and content hash; candidate id, git revision, prompt version, provider, model and
config; a fingerprint over all of those; start/finish time; per case: pass/fail, safety violations,
error code, output hash, latency, and token usage **only if the provider reported it** (otherwise `null`).
No cost is recorded: there is no documented measured rate.

Task success, safety, latency and tokens are reported **separately**. There is no combined fitness number.

## Promotion rules

A candidate is *eligible* only if: it ran the same suite content (hash) as the current champion, every
required case passes, there are zero safety violations, and no case that passed for the champion fails now.

Eligible is not promoted. A named human must approve via the `[id]` route. Promotion routes **fail
closed**: they need `HELLO_OPERATOR_TOKEN` set *and* a matching `x-operator-token` header (the
dev-mode open access of other operator routes does not apply). Approval is rechecked against the
current champion; each request can be decided once; rollback restores the previous champion. Every
step writes an audit-log row naming the actor.

## Running

```bash
export DATABASE_URL=file:/tmp/hello-eval.db           # disposable
npx prisma db push --skip-generate
npm run test:eval                                      # offline tests
npm run eval:offline -- --candidate good               # scripted fixture replies
npm run eval:offline -- --candidate unsafe             # shows blocked safety cases
npm run eval:offline -- --candidate good --save        # store the run in DATABASE_URL

# Opt-in live run against the configured HELLO_AI_* provider (never in CI):
HELLO_EVAL_LIVE=1 npm run eval:offline -- --candidate my-model --save
```

Fixture runs check the harness and graders; they say nothing about any real model.

## Turso

New tables: apply `prisma/turso/2026-10-21-eval.sql` to an existing Turso database
(`prisma/turso/init.sql` is regenerated for new databases).

## Limits

- One small suite. Graders are string/regex/JSON checks, not semantic judges.
- No UI page yet; use the API or CLI.
- Live latency depends on the network and provider and is not a benchmark.
