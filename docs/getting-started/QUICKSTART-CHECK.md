# Clean-clone quickstart check (2026-10-21)

Commit tested: `main` @ `972b3e9`, fresh `git clone` into `/tmp/qs`, Node v22.23.3 via `npx node@22`, Linux box, no `HELLO_*` or `DATABASE_URL` in the shell.

| Step (as documented) | Result |
| --- | --- |
| `npm install` | ok. Rewrote `package-lock.json` (added `"hasInstallScript": true`), so the committed lockfile was slightly stale. **Fixed in this PR.** Prefer `npm ci`. |
| `cp .env.example .env` | ok |
| `npx prisma generate` | ok |
| `npx prisma db push` | ok, created `prisma/db/custom.db`. That directory was untracked and not ignored. **Fixed: added to `.gitignore`.** |
| `npm run dev` | Turbopack crashed with "OS file watch limit reached". That's a limit of this box, not of the repo. `WATCHPACK_POLLING=true npx next dev --webpack` worked. Smoke results below. Raise `fs.inotify.max_user_watches` if you hit this. |
| `next dev` side effect | Next 16 appended a generated block to the repo's `AGENTS.md`. **Fixed: `agentRules: false` in `next.config.ts`.** |
| `npm run build` | ok (now with `typescript.ignoreBuildErrors: false`) |
| `npm start` (standalone) with the default relative `DATABASE_URL` | **500 "Unable to open the database file"**: the standalone server runs from `.next/standalone`, where `./db/custom.db` doesn't exist. Workaround: use an absolute path, e.g. `DATABASE_URL=file:$PWD/prisma/db/custom.db npm start`. Not fixed in code (see gaps). |
| Docker Compose | **Not run.** `docker` exists but the box user can't reach `/var/run/docker.sock` ("permission denied"), and the `docker compose` plugin isn't installed. |

Smoke against `next dev` (port 3112):

| Request | Status | Body (truncated) |
| --- | --- | --- |
| `GET /api/agents` | 200 | `{"agents":[]}` (empty database, no demo rows) |
| `GET /api/operator` | 200 | `"killSwitch":false … "devMode":true` |
| `POST /api/agents {"name":"QS"}` | 200 | response contains no `privateKeyHex` |
| `GET /api/ai/status` (from the `npm start` run) | 200 | `{"configured":false,"reason":"HELLO_AI_PROVIDER is not set",…}` |
