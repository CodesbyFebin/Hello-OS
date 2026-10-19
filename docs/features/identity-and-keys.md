# Identity and key handling

**Status:** identity is shipped. The leak fix is **in PR #4** (available once PR #4 merges).

- `POST /api/agents` creates an agent with a real Ed25519 keypair and `did:key`, a soul v1 and a wallet. `GET /api/agents`, `GET /api/agents/[id]` and `GET /api/did/[did]` read identities.
- The demo server stores `privateKeyHex` in SQLite. That is **prototype custody, not production custody**.

## The leak (fixed in PR #4)
On `main`, `GET /api/agents` returned `privateKeyHex` (confirmed with a live request). The `POST` response, `/api/agents/[id]`, export, DID and stats routes return full agent rows too. PR #4 adds a Prisma **global omit** in `src/lib/db.ts`, so no query returns the key by default, including `create()` results and nested includes. Only the three server-side signing routes (`a2a`, `attestations`, `observations`) opt in with `omit: { privateKeyHex: false }`, and none of them return it. `tests/secrets.test.mjs` (`npm run test:secrets`) fails on `main` and passes with the fix. It also fails if a new route opts in without review.

Snapshots (#11) select public identity fields explicitly. The SQL connector (#7) rejects and redacts secret-bearing columns.

**Planned:** KMS/HSM-backed keys, rotation and operator-managed revocation lists.
