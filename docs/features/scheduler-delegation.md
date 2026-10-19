# Heartbeat scheduler and delegation tree

**Status: in PR #6.** Available once PR #6 merges.

## Scheduler
| Route | Method | Purpose |
| --- | --- | --- |
| `/api/scheduler/jobs` | GET / POST `{kind, intervalSec (10..2592000), agentId?, name?}` | list or create jobs |
| `/api/scheduler/jobs/[id]` | PATCH `{enabled?, runNow?}` · DELETE | manage a job |
| `/api/scheduler/tick` | POST | run all due jobs |

- **Kinds:** `heartbeat`, `wallet.audit` (open circuits, near-cap and low-balance wallets) and `missions.stale` (open missions older than 7 days).
- Each due job is claimed atomically, so concurrent ticks can't double-run it, and is then rescheduled.
- **No background daemon:** call the tick endpoint from cron (see the [operator guide](../operator-guide.md)), or use the auto-tick toggle, which only works while `/ops/scheduler` is open.
- Mutating routes need `HELLO_OPERATOR_TOKEN` when it is set.

## Delegation tree
| Route | Method | Purpose |
| --- | --- | --- |
| `/api/delegation[?root=]` | GET | nested tree(s) |
| `/api/delegation` | POST `{parentId, childName? \| childId?, creditCap, task?}` | spawn (new Ed25519 did:key) or adopt a child and fund it |
| `/api/delegation/[id]/recall` | POST | return the child's unspent credits (up to the cap) to the parent |

- The parent is debited atomically, and the request fails if it can't cover the cap.
- The child's balance and daily cap are bounded by the grant, so grandchildren are bounded by their parent.
- Prototype credits only.
- **UI:** `/ops/scheduler`, `/ops/delegation`. **Tests:** `npm run test:scheduler`.
