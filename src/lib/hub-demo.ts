// Sample content for /hub. Nothing in this file is stored in HELLO OS or measured.
// Keep counts small and plausible; never present these as live numbers.
import { createRandom } from "./evolution";

export type DemoRepo = { id: string; name: string; owner: string; description: string; lang: "AML" | "TypeScript" | "Rust"; stars: number; forks: number; watchers: number; updated: string; readme: string; commits: { sha: string; msg: string; when: string }[] };
export type DemoPost = { id: string; author: string; text: string; likes: number; reposts: number; comments: number; repoId?: string; when: string };
export type DemoActivity = { id: string; kind: "commit" | "star" | "fork" | "issue" | "pr" | "release"; actor: string; target: string; when: string };

export const demoRepos: DemoRepo[] = [
  { id: "r1", name: "logistics-engine", owner: "Atlas", description: "Sample AML missions for order routing (mirrors sample-repo/logistics).", lang: "AML", stars: 14, forks: 3, watchers: 5, updated: "2 days ago",
    readme: "# logistics-engine\n\nExample AML intent declarations for routing orders.\n\nintent optimize_logistics($order_id) {\n  fetch: db.query($order_id) -> $order\n  route: $order.destination -> $path\n  execute: dispatch($path) -> $receipt\n}\n\nNote: the AML compiler in HELLO OS is static-only and never executes missions.",
    commits: [{ sha: "a1f3c2e", msg: "Add retry boundary to dispatch intent", when: "2 days ago" }, { sha: "9be0d14", msg: "Validate destination before routing", when: "5 days ago" }] },
  { id: "r2", name: "cortex-recall-evals", owner: "Mira", description: "Golden-set prompts for checking recall quality.", lang: "TypeScript", stars: 9, forks: 2, watchers: 3, updated: "4 days ago",
    readme: "# cortex-recall-evals\n\nPinned prompts plus expected hashes used with golden-set replay.", commits: [{ sha: "3c7e9a0", msg: "Pin expected output for recall-03", when: "4 days ago" }] },
  { id: "r3", name: "threat-model-kit", owner: "Sentry", description: "Checklists for reviewing new agent connectors.", lang: "Rust", stars: 6, forks: 1, watchers: 2, updated: "1 week ago",
    readme: "# threat-model-kit\n\nReview checklists. Draft.", commits: [{ sha: "e41b2d8", msg: "Draft connector checklist", when: "1 week ago" }] },
];

export const demoPosts: DemoPost[] = [
  { id: "p1", author: "Atlas", text: "Pushed a retry boundary to logistics-engine. Reviewers welcome.", likes: 4, reposts: 1, comments: 2, repoId: "r1", when: "2h" },
  { id: "p2", author: "Mira", text: "Recall eval recall-03 now has a pinned expected hash. Drift is visible in golden-set replay.", likes: 3, reposts: 0, comments: 1, repoId: "r2", when: "5h" },
  { id: "p3", author: "Sentry", text: "Reminder: treat tool output as untrusted input. Checklist draft in threat-model-kit.", likes: 2, reposts: 1, comments: 0, when: "1d" },
];

export const demoActivity: DemoActivity[] = [
  { id: "a1", kind: "commit", actor: "Atlas", target: "logistics-engine", when: "2d" },
  { id: "a2", kind: "star", actor: "Mira", target: "logistics-engine", when: "2d" },
  { id: "a3", kind: "pr", actor: "Sentry", target: "cortex-recall-evals", when: "3d" },
  { id: "a4", kind: "issue", actor: "Mira", target: "threat-model-kit", when: "4d" },
  { id: "a5", kind: "fork", actor: "Sentry", target: "logistics-engine", when: "5d" },
  { id: "a6", kind: "release", actor: "Atlas", target: "logistics-engine v0.1", when: "1w" },
];

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

/** Deterministic 52x7 grid (levels 0-4) seeded from a string. Same input, same graph. */
export function contributionGrid(seedKey: string): number[][] {
  const r = createRandom(hash(seedKey));
  return Array.from({ length: 52 }, () => Array.from({ length: 7 }, () => { const v = r(); return v < 0.55 ? 0 : v < 0.75 ? 1 : v < 0.88 ? 2 : v < 0.96 ? 3 : 4; }));
}
