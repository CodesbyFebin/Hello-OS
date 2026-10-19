# Merge order for the open PRs

Nothing below is merged yet unless GitHub shows it as merged. Suggested order:

1. **#4**: stop API routes returning `privateKeyHex`. Merge first.
2. **#5**: approval gate, kill switch, audit log. Then **#13** (consensus + treasury). It is stacked on #5 and GitHub retargets it to `main` after #5 merges.
3. **#6** (scheduler + delegation), **#11** (snapshots + failures), **#12** (cache + knowledge), **#14** (Wasm sandbox), in any order.
4. **#10** (`/runtime`), then **#16** (wires pillars 3 and 5–10). #16 is stacked on #10.
5. **#7** (integrations), **#8** (`/frontier`), **#9** (layers + AML preview), **#15** (`/roadmap`) are independent.

## Expected conflicts (trivial)
- `package.json` scripts: each PR adds one `test:*` line. Keep them all.
- `prisma/schema.prisma`: PRs add model blocks in different places. Keep both blocks if Git flags them.
- `src/components/hub/hub-shell.tsx` nav: #7 and #15 each add a tab. Keep both.
- The `/ops` shell (`src/app/ops/page.tsx`, `src/components/ops/*`, `tests/register.mjs`, `tests/alias-hooks.mjs`, `src/lib/similarity.ts`, `src/lib/operator-auth.ts`) is byte-identical across PRs and merges cleanly.

## After merging
```bash
npx prisma db push
npm run build
npm run test:aml && npm run test:evolution        # Node 22 (`npx node@22`) for the node:test suites
npm run test:secrets   # #4  (needs DATABASE_URL pointing at a scratch DB)
npm run test:gate      # #5
npm run test:scheduler # #6
npm run test:snapshots # #11
npm run test:cache     # #12
npm run test:consensus # #13
npm run test:sandbox   # #14
```
The `test:*` scripts that touch the database run `prisma db push` against `DATABASE_URL` first. Point it at a disposable file, e.g. `DATABASE_URL=file:/tmp/hello-test.db npm run test:gate`.

A local, unpushed merge of #5, #6 and #11–#14 with #16 validated the schema, built, and passed all 15 new and 12 existing node tests.
