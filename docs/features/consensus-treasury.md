# Consensus/debate protocol and treasury reallocation

**Status: in PR #13**, stacked on PR #5. Available once PRs #5 and #13 merge.

## Consensus & debate
- `GET /api/consensus` lists debates. `POST /api/consensus {proposerId, topic, quorumWeight}` opens one.
- `POST /api/consensus/[id]` with `{op:"argue", agentId, stance, text}`, `{op:"vote", agentId, stance}` or `{op:"close"}`.
- Voting is refused until **both sides have argued**. Each agent votes once, weighted by its reputation at vote time.
- Closing gives `passed` or `rejected` by weight, or `no_quorum` if the total weight is below quorum.
- **Limit:** agents or operators write the arguments. No model generates or judges them.

## Treasury reallocation
- `POST /api/treasury/reallocate {fromAgentId, toAgentId, amount, reason}` passes the approval gate as `treasury.reallocate`:
  - at or under the threshold it runs;
  - above it, it returns 202 and waits for an operator;
  - the kill switch returns 423.
- The debit goes through `spendWallet` (daily cap and circuit breaker), and the credit is in the same transaction.
- `GET /api/treasury` returns recent moves and the pending count. Prototype credits only.
- **UI:** `/ops/consensus`, `/ops/treasury`. **Tests:** `npm run test:consensus`.
