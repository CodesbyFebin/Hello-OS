// Connector #1: GitHub, read-only. GET requests to the public REST API only.
// GITHUB_TOKEN is optional, read from env, and never included in any result.

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<any>; headers: { get(name: string): string | null } }>;

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const API = "https://api.github.com";

export type GithubResource = "repo" | "issues" | "pulls";

function headers(token?: string) {
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "hello-os-connector" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function githubUrl(resource: GithubResource, owner: string, repo: string, opts: { state?: string; perPage?: number } = {}) {
  if (!NAME.test(owner) || !NAME.test(repo)) throw new Error("owner and repo must be valid GitHub names");
  const base = `${API}/repos/${owner}/${repo}`;
  if (resource === "repo") return base;
  const state = ["open", "closed", "all"].includes(opts.state ?? "") ? opts.state : "open";
  const per = Math.max(1, Math.min(50, Math.floor(opts.perPage ?? 10)));
  if (resource === "issues" || resource === "pulls") return `${base}/${resource}?state=${state}&per_page=${per}`;
  throw new Error(`unknown resource: ${resource}`);
}

function slim(resource: GithubResource, data: any) {
  if (resource === "repo") {
    return { fullName: data.full_name, description: data.description, defaultBranch: data.default_branch, stars: data.stargazers_count, forks: data.forks_count, openIssues: data.open_issues_count, private: data.private, url: data.html_url, pushedAt: data.pushed_at };
  }
  const list = Array.isArray(data) ? data : [];
  return list
    .filter((i) => resource === "pulls" || !i.pull_request) // issues endpoint also returns PRs
    .map((i) => ({ number: i.number, title: i.title, state: i.state, author: i.user?.login ?? null, url: i.html_url, createdAt: i.created_at, updatedAt: i.updated_at, labels: (i.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name)) }));
}

export async function githubRead(args: { resource: GithubResource; owner: string; repo: string; state?: string; perPage?: number }, fetchImpl: FetchLike = fetch as unknown as FetchLike, token = process.env.GITHUB_TOKEN) {
  const url = githubUrl(args.resource, args.owner, args.repo, args);
  const res = await fetchImpl(url, { method: "GET", headers: headers(token) });
  if (!res.ok) return { error: `GitHub API responded ${res.status}`, status: res.status, authenticated: Boolean(token) };
  return { resource: args.resource, data: slim(args.resource, await res.json()), authenticated: Boolean(token), rateLimitRemaining: res.headers.get("x-ratelimit-remaining") };
}
