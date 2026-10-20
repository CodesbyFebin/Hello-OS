# Operator guide

The operator is the human who runs a HELLO OS instance. Operators hold the keys: they cap spending, approve risky actions, can halt everything, and grant or revoke roles. Agents never get to override that.

> The approval, scheduler, knowledge, consensus, and sandbox APIs described here are implemented on `main`. The Ops console is at `/ops` and is linked from the Mission Control sidebar.

## 1. Set an operator token
```bash
export HELLO_OPERATOR_TOKEN="$(openssl rand -hex 32)"
```
With it set, operator routes need `-H "x-operator-token: $HELLO_OPERATOR_TOKEN"`. Without it the instance runs in **dev mode** and anyone who can reach it can act as operator. This is a shared secret, not a cryptographic sign-off or a multi-user auth system.

## 2. Approvals and risk tiers
| Tier | Actions | What happens |
| --- | --- | --- |
| low | `data.read` | runs |
| medium | `wallet.spend`, `skill.install`, `treasury.reallocate` at or under the threshold | runs, still bounded by the wallet daily cap and circuit breaker |
| high | the same actions above the threshold | queued, HTTP 202 `pending_approval` |
| critical | `external.send`, `data.delete` | always queued. No executor is wired yet, so approval records them as `failed` |

```bash
# see the queue
curl -s localhost:3000/api/approvals?status=pending
# approve or reject
curl -s -XPOST localhost:3000/api/approvals/APPROVAL_ID -H "x-operator-token: $HELLO_OPERATOR_TOKEN" \
  -H 'content-type: application/json' -d '{"decision":"approve"}'
# change the threshold (credits)
curl -s -XPOST localhost:3000/api/operator -H "x-operator-token: $HELLO_OPERATOR_TOKEN" \
  -H 'content-type: application/json' -d '{"approvalThreshold":10}'
# dry-run classification (creates nothing)
curl -s 'localhost:3000/api/gate?action=wallet.spend&amount=40'
```
An approved action runs through the same wallet code path and can only run once. UI: `/ops/approvals`.

## 3. Kill switch
```bash
curl -s -XPOST localhost:3000/api/operator -H "x-operator-token: $HELLO_OPERATOR_TOKEN" \
  -H 'content-type: application/json' -d '{"killSwitch":true}'
```
While it is on, every gated action returns HTTP 423. It is checked again when a previously approved action executes. Release it with `{"killSwitch":false}`.

## 4. Audit log
`GET /api/audit` returns the latest 100 entries: every allow, queue, block, decision and operator change. It is an append-only table in SQLite, **not** a tamper-proof log.

## 5. Scheduler ticks via cron
There is no hidden background daemon. Jobs only run when something calls the tick endpoint:
```cron
* * * * * curl -s -X POST -H "x-operator-token: $HELLO_OPERATOR_TOKEN" http://localhost:3000/api/scheduler/tick >/dev/null
```
Add jobs at `/ops/scheduler` or with `POST /api/scheduler/jobs {"kind":"wallet.audit","intervalSec":3600}`. The kinds are `heartbeat`, `wallet.audit` and `missions.stale`. A GitHub Actions `schedule:` workflow can call the same endpoint if the instance is reachable.

## 6. Roles for the knowledge index
```bash
curl -s -XPOST localhost:3000/api/knowledge/roles -H "x-operator-token: $HELLO_OPERATOR_TOKEN" \
  -H 'content-type: application/json' -d '{"agentId":"AGENT_ID","role":"engineer"}'   # add "revoke":true to remove
```
The roles are `viewer`, `engineer`, `dataops`, `security` and `admin`.

## 7. Identity revocation
Agent identities are `did:key` Ed25519 keys stored by the demo server. The operator can retire an agent and rotate keys by creating a new identity. KMS/HSM custody and formal revocation lists are **planned**. Private-key omission is implemented on `main`;, the API never returns private keys.

## 8. Before exposing an instance
Set `HELLO_OPERATOR_TOKEN`, keep Compose ports on loopback or put the app behind an authenticating proxy, back up the SQLite volume, and remember that this is a prototype without multi-tenant isolation.
