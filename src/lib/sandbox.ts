// Wasm sandbox for agent-written snippets. Each run gets a fresh QuickJS
// runtime compiled to WebAssembly (quickjs-emscripten, pinned) with a memory
// limit, stack limit and wall-clock deadline. Only `console.log` is exposed;
// there is no fs, network, timers, process or host object access.
import { getQuickJS, shouldInterruptAfterDeadline } from "quickjs-emscripten";

export const LIMITS = { maxCodeChars: 20_000, maxOutputChars: 20_000, defaultTimeoutMs: 1000, maxTimeoutMs: 5000, defaultMemoryBytes: 16 * 1024 * 1024, maxMemoryBytes: 64 * 1024 * 1024, stackBytes: 512 * 1024 };

export type RunResult = { ok: boolean; result?: unknown; error?: string; logs: string[]; durationMs: number; limits: { timeoutMs: number; memoryBytes: number } };

export async function runSnippet(code: string, opts: { timeoutMs?: number; memoryBytes?: number } = {}): Promise<RunResult> {
  const timeoutMs = Math.min(Math.max(Number(opts.timeoutMs) || LIMITS.defaultTimeoutMs, 10), LIMITS.maxTimeoutMs);
  const memoryBytes = Math.min(Math.max(Number(opts.memoryBytes) || LIMITS.defaultMemoryBytes, 1024 * 1024), LIMITS.maxMemoryBytes);
  const logs: string[] = []; let outChars = 0;
  const t0 = Date.now();
  if (code.length > LIMITS.maxCodeChars) return { ok: false, error: `code exceeds ${LIMITS.maxCodeChars} chars`, logs, durationMs: 0, limits: { timeoutMs, memoryBytes } };

  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(memoryBytes);
  runtime.setMaxStackSize(LIMITS.stackBytes);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs));
  const vm = runtime.newContext();
  try {
    const consoleObj = vm.newObject();
    const log = vm.newFunction("log", (...args) => {
      const line = args.map((a) => { const v = vm.dump(a); return typeof v === "string" ? v : JSON.stringify(v); }).join(" ");
      if (outChars < LIMITS.maxOutputChars) { logs.push(line.slice(0, LIMITS.maxOutputChars - outChars)); outChars += line.length; }
    });
    vm.setProp(consoleObj, "log", log);
    vm.setProp(vm.global, "console", consoleObj);
    log.dispose(); consoleObj.dispose();

    const res = vm.evalCode(code, "snippet.js");
    if (res.error) {
      const err = vm.dump(res.error); res.error.dispose();
      const msg = typeof err === "object" && err ? `${err.name ?? "Error"}: ${err.message ?? JSON.stringify(err)}` : String(err);
      return { ok: false, error: msg, logs, durationMs: Date.now() - t0, limits: { timeoutMs, memoryBytes } };
    }
    const value = vm.dump(res.value); res.value.dispose();
    let result: unknown = value;
    try { JSON.stringify(value); } catch { result = String(value); }
    return { ok: true, result, logs, durationMs: Date.now() - t0, limits: { timeoutMs, memoryBytes } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), logs, durationMs: Date.now() - t0, limits: { timeoutMs, memoryBytes } };
  } finally {
    vm.dispose(); runtime.dispose();
  }
}