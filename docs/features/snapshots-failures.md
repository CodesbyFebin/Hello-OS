# Checkpoint/resume snapshots and failure library

**Status:** shipped on `main` as a sealed portable-record prototype; this is not a VM or database snapshot.

## Snapshots
| Route | Method | Purpose |
| --- | --- | --- |
| `/api/snapshots` | GET / POST `{agentId, task?, label?}` | list or seal a snapshot (task state ≤ 20 KB) |
| `/api/snapshots/[id]` | GET | export `{sha256, snapshot}` |
| `/api/snapshots/resume` | POST `{snapshot, sha256}` | verify the seal and resume |

- A `hello-snapshot/v1` document holds public identity (no key material), the latest soul version and hash, working memories (CORE/RECALL), wallet figures and caller task state. It is sealed with SHA-256 over canonical JSON.
- Resume rejects a modified document (422), matches the agent by DID, restores missing memories (idempotent) and returns the task state.
- **Limits:** it captures database records, not model internals or KV caches. Resume **never moves credits**.

## Failure library (dead-end registry)
| Route | Method | Purpose |
| --- | --- | --- |
| `/api/failures` | GET / POST `{log, source?}` | list records or ingest a raw log (≤ 500 KB) |
| `/api/failures/similar?q=` | GET | retrieve similar past failures and their fixes |
| `/api/failures/[id]` | PATCH `{resolution}` | record a fix; the failure is no longer a dead end |

- Parses tsc, eslint, node:test `not ok` and `Error:` lines.
- Volatile parts (numbers, quoted values, hex) are normalised into a signature. The count goes up once per ingest.
- Retrieval uses local hashed-trigram cosine (`src/lib/similarity.ts`). There is no embedding model and no network.
- Feed it from CI: `npx tsc --noEmit | jq -Rs '{log:.}' | curl -XPOST -H 'content-type: application/json' -d @- localhost:3000/api/failures`
- **UI:** `/ops/snapshots`, `/ops/failures`. **Tests:** `npm run test:snapshots`.
