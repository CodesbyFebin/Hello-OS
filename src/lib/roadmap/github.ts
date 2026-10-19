// Runtime evidence from the public GitHub API (unauthenticated, cached).
// Falls back gracefully: if GitHub is unreachable, statuses stay as committed in steps.ts.
import type { Step, StepStatus } from "./steps";

export interface PrInfo { number: number; title: string; state: "open" | "closed"; merged: boolean; url: string; updatedAt: string }
export interface EvidenceEvent { kind: "pr" | "commit"; at: string; label: string; url: string; ref: string }
export interface Evidence { source: "github" | "unavailable"; fetchedAt: string; prs: Record<number, PrInfo>; events: EvidenceEvent[]; error?: string }

/** in-pr steps become shipped when merged, planned when closed unmerged. */
export function resolveStatus(step: Step, prs: Record<number, PrInfo>): { status: StepStatus; pr?: PrInfo } {
  if (step.status !== "in-pr" || !step.pr) return { status: step.status };
  const pr = prs[step.pr];
  if (!pr) return { status: "in-pr" };
  if (pr.merged) return { status: "shipped", pr };
  if (pr.state === "closed") return { status: "planned", pr };
  return { status: "in-pr", pr };
}

export function parseEvidence(pulls: any[], commits: any[]): Pick<Evidence, "prs" | "events"> {
  const prs: Record<number, PrInfo> = {};
  const events: EvidenceEvent[] = [];
  for (const p of Array.isArray(pulls) ? pulls : []) {
    const merged = Boolean(p.merged_at);
    prs[p.number] = { number: p.number, title: String(p.title ?? ""), state: p.state === "closed" ? "closed" : "open", merged, url: String(p.html_url ?? ""), updatedAt: String(p.updated_at ?? "") };
    events.push({ kind: "pr", at: String(p.merged_at ?? p.closed_at ?? p.created_at ?? ""), label: `PR #${p.number} ${merged ? "merged" : p.state === "closed" ? "closed" : "opened"}: ${p.title}`, url: String(p.html_url ?? ""), ref: `#${p.number}` });
  }
  for (const c of Array.isArray(commits) ? commits : []) {
    events.push({ kind: "commit", at: String(c.commit?.committer?.date ?? c.commit?.author?.date ?? ""), label: String(c.commit?.message ?? "").split("\n")[0], url: String(c.html_url ?? ""), ref: String(c.sha ?? "").slice(0, 7) });
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return { prs, events: events.slice(0, 25) };
}

export async function fetchEvidence(repo: string, fetchImpl: typeof fetch = fetch): Promise<Evidence> {
  const fetchedAt = new Date().toISOString();
  const opts = { headers: { Accept: "application/vnd.github+json", "User-Agent": "hello-os-roadmap" }, next: { revalidate: 600 } } as RequestInit;
  try {
    const [pr, cm] = await Promise.all([
      fetchImpl(`https://api.github.com/repos/${repo}/pulls?state=all&per_page=50&sort=updated&direction=desc`, opts),
      fetchImpl(`https://api.github.com/repos/${repo}/commits?sha=main&per_page=15`, opts),
    ]);
    if (!pr.ok || !cm.ok) throw new Error(`GitHub API responded ${pr.status}/${cm.status}`);
    return { source: "github", fetchedAt, ...parseEvidence(await pr.json(), await cm.json()) };
  } catch (e) {
    return { source: "unavailable", fetchedAt, prs: {}, events: [], error: (e as Error).message };
  }
}
