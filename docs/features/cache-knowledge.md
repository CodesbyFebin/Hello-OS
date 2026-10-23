# Semantic cache and permission-scoped knowledge index

**Status:** shipped on `main`.

## Semantic cache
| Route | Method | Purpose |
| --- | --- | --- |
| `/api/cache` | GET | `{entries, lookups, hits, measuredHitRate}` |
| `/api/cache` | POST `{prompt, response, scope?}` | store a pair |
| `/api/cache/lookup` | POST `{prompt, threshold? (0..1], default 0.9, scope?}` | hit or miss |

- Every lookup is logged, so the hit rate is **measured** on this instance. It is `null` until there are lookups. **No savings figure is claimed.**
- **Limits:** similarity is lexical (hashed trigrams), not semantic. No model is called. In a local check, a casing/punctuation rewrite hit at 0.98, while "How do I run Postgres in Docker?" missed at 0.87. Lower thresholds raise the risk of wrong answers.

## Knowledge index (RBAC)
| Route | Method | Purpose |
| --- | --- | --- |
| `/api/knowledge` | GET / POST `{title, body, allowedRoles[]}` | list or add docs (operator) |
| `/api/knowledge/roles` | POST `{agentId, role, revoke?}` | grant or revoke (operator) |
| `/api/knowledge/search?agentId=&q=` | GET | ranked results the agent may read, plus a `hidden` count |

- Documents an agent can't read are removed **before** ranking. `admin` reads everything.
- The roles are `viewer`, `engineer`, `dataops`, `security` and `admin`.
- **UI:** `/ops/cache`, `/ops/knowledge`. **Tests:** `npm run test:cache`.
