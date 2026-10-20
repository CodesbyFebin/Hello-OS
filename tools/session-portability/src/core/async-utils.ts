// A genuine macrotask yield — NOT `Promise.resolve()`/`await null`, which
// only defers to the microtask queue. Node advances to the timer/macrotask
// phase (where `setInterval`/`setTimeout`-driven work like a TUI render loop
// or a spinner animation lives) only once the microtask queue is fully
// drained; a hot loop whose every `await` resolves via an already-settled
// promise (e.g. a per-item ledger/adapter chain with no real I/O wait) keeps
// re-feeding the microtask queue and can starve that phase indefinitely.
// `setImmediate` forces a real hop through the event loop's check phase.
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}
