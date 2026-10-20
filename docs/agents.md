# HELLO OS: agent and crawler guide

HELLO OS is an experimental local-first software prototype for agent identity, persistent records, mission workflows, selected tool integrations, and inspectable work. It does not provide a production cloud runtime or general-purpose autonomous execution engine.

## Canonical sources

- Source repository: https://github.com/CodesbyFebin/Hello-OS
- GitHub Pages guide: https://codesbyfebin.github.io/Hello-OS/
- Main README: https://github.com/CodesbyFebin/Hello-OS/blob/main/README.md
- Wiki-ready source pages: https://github.com/CodesbyFebin/Hello-OS/tree/main/docs/wiki
- Machine-readable summary: https://codesbyfebin.github.io/Hello-OS/llms.txt
- GitHub Wiki: https://github.com/CodesbyFebin/Hello-OS/wiki

## Implemented interfaces

- `GET /api/hello/handshake` returns bootstrap information.
- `GET` and `POST /api/a2a` provide an A2A-style JSON-RPC task surface.
- `POST /api/aml/compile` and `POST /api/aml/validate` statically parse and validate AML.
- `/api/agents`, `/api/missions`, `/api/hello/cortex/*`, `/api/hello/forge/*`, and `/api/hello/mcp/*` expose prototype application APIs. Use the source for exact current schemas and methods.
- `/.well-known/agent-card.json` provides agent-card discovery.

## Capability boundaries

- AML is non-executable. Its operation names do not invoke tools or shell commands.
- Wallet amounts are internal records, not cryptocurrency or payment balances.
- Checkpoints are persisted records; they do not create VM, filesystem, or database snapshots.
- There is no configured model-provider inference or universal model router.
- The dashboard reads configured APIs and shows empty or unavailable states. The standalone HELLO EVOLVE page is a simulation; generated showcase artwork is synthetic.
- GitHub Pages serves static documentation and cannot run the application APIs, SQLite database, or MCP service.
- Robots, sitemap, and metadata settings do not guarantee crawling, indexing, ranking, or AI citations.

## Safe interaction

Use documented schemas and local test data. Separate read and write operations. Do not send secrets or sensitive personal data to an unreviewed instance, and do not invoke state-changing tools unless the operator has authorized the activity.
