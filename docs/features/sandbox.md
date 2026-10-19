# Wasm snippet sandbox

**Status: in PR #14.** Available once PR #14 merges.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/sandbox` | GET | engine and limits |
| `/api/sandbox` | POST `{code, timeoutMs?, memoryBytes?}` | run a JavaScript snippet (operator token when set) |

- **Engine:** `quickjs-emscripten@0.32.0`, pinned exact. It is QuickJS compiled to WebAssembly and runs server-side (`serverExternalPackages` in `next.config.ts`).
- **Limits:** a fresh runtime per run, memory 16 MB default (64 MB max), a 512 KB stack, a wall-clock deadline of 1 s default (5 s max), and 20k chars each for code and output.
- **Isolation:** only `console.log` is exposed. There's no `require`, `process`, `fetch`, timers, or `std`/`os` modules, so there's no file or network access.
- **Limits of the design:** JavaScript only, runs on the Node event loop (bounded by the deadline) and has no per-agent quotas.
- **UI:** `/ops/sandbox` (presets for CSV parsing, an infinite loop, a memory bomb and a host probe). **Tests:** `npm run test:sandbox`.
