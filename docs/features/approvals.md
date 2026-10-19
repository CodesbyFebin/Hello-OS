# Approval gate, kill switch and audit log

**Status: in PR #5.** Available once PR #5 merges.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/agents/[id]/wallet/spend` | POST | now gated; returns 202 `pending_approval` for high-risk spends |
| `/api/marketplace/[id]/install` | POST | now gated |
| `/api/gate?action=&amount=` | GET | dry-run classification |
| `/api/approvals[?status=]` | GET | queue |
| `/api/approvals/[id]` | POST `{decision: approve\|reject, note?}` | operator decision, executes on approve |
| `/api/operator` | GET / POST `{killSwitch?, approvalThreshold?}` | operator controls |
| `/api/audit` | GET | latest 100 audit entries |

- **Models:** `OperatorControl` (singleton: kill switch, threshold, default 25 credits), `ActionApproval` and `AuditLog`.
- **Code:** `src/lib/gate.ts` and `src/lib/skills.ts`.
- **UI:** `/ops/approvals`.
- **Env:** `HELLO_OPERATOR_TOKEN` (see [configuration](../configuration.md)).
- **Tests:** `npm run test:gate`.

**Security notes:**
- Operator auth is a shared token. With the token unset, the instance runs in dev mode.
- An approved action executes through `spendWallet`/`installSkill` (caps and circuit breaker apply) and can't run twice.
- `external.send`/`data.delete` have no executors yet.
- The audit log is not tamper-proof.
