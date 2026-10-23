# Identity and key handling

**Status:** identity and private-key omission are implemented on `main`. Key material remains stored by the demo server and is not production-grade custody.

- `POST /api/agents` creates an agent with a real Ed25519 keypair and `did:key`, a soul v1 and a wallet. `GET /api/agents`, `GET /api/agents/[id]` and `GET /api/did/[did]` read identities.
- The demo server stores `privateKeyHex` in SQLite. That is **prototype custody, not production custody**.

## Key serialization
`src/lib/db.ts` configures a Prisma global omit for `privateKeyHex`, so normal reads and create responses do not include the private key. Signing routes opt in only server-side with `omit: { privateKeyHex: false }`; they must never return the key. `tests/secrets.test.mjs` checks API serialization and server-side signing behavior.

Snapshots (#11) select public identity fields explicitly. The SQL connector (#7) rejects and redacts secret-bearing columns.

**Planned:** KMS/HSM-backed keys, rotation and operator-managed revocation lists.
