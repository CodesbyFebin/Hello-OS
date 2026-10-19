# Contributing to HELLO OS

Thanks for helping HELLO evolve. This is an experimental prototype, so honesty and reproducibility matter more than polish.

## Ground rules
- **No unverified claims.** Benchmarks, token savings, user counts or "production" wording need a reproducible script or test in the same PR.
- **Label vision vs shipped.** Docs must say clearly when something is proposed and not implemented.
- **Never commit secrets**, private keys, real `.env` files or database files (`db/`, `prisma/db/`).
- Keep PRs small and focused, and say what you tested and what you couldn't.

## Setup
```sh
npm install
cp .env.example .env
npx prisma generate && npx prisma db push
npm run dev          # http://localhost:3000
npm run mcp          # MCP service on :3030 (needs Bun)
```
Or use `docker compose up --build`.

## Checks before a PR
```sh
npm run build        # must pass
npm run lint         # there are known existing errors, so don't add new ones
npx tsc --noEmit     # there are known existing errors, so don't add new ones
npm run test:aml     # needs Node 22+ (uses --experimental-strip-types)
```

## Ways to contribute
- **Evals**: a pinned prompt plus its expected result that measures whether a change helps.
- **Tasks / skills**: include a test.
- **Bug fixes**: start with issues labelled `good first issue`.
- **Docs**: fix any place where the docs and the code disagree.

## Security
Don't open public issues for vulnerabilities. Contact the maintainer privately through their GitHub profile.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
