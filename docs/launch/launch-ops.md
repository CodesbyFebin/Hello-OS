# Launch operations checklist

## Before scheduling a date

- Choose a stable public domain and configure canonical metadata, sitemap origin, and crawler responses.
- Decide whether the launch is for local developers, agent-framework integrators, or both; keep the first announcement focused.
- Verify the exact source revision, Docker instructions, supported routes, and actual release assets.
- If collecting email, select and configure a real provider with explicit consent, double opt-in, unsubscribe, export, and deletion. Test these flows before publishing a signup form.
- Create a release note that distinguishes implemented behavior from future work.
- Prepare screenshots, short recordings, and captions that identify synthetic data.
- Confirm access to each posting account and review the platform's current rules on the day of launch.

## Four-hour coordinated window

Suggested order, relative to a maintainer-selected T0:

| Offset | Action | Evidence or follow-up |
| --- | --- | --- |
| T-30 min | Verify website, GitHub release, Pages downloads, and issue links | HTTP status and release-asset check |
| T0 | Publish GitHub release and repository announcement | Tag, changelog, tested source archive |
| T+15 min | Submit Show HN draft if appropriate | Monitor questions; answer from implementation evidence |
| T+45 min | Publish a community-specific Reddit post where promotion is allowed | Stay for discussion; no copy-paste cross-posting |
| T+90 min | Publish X thread and a short demo clip | Link to source and prototype limits |
| T+150 min | Publish Product Hunt listing if the account and assets are ready | Respond to comments; no vote requests or engagement schemes |
| T+210 min | Share LinkedIn summary and contributor call | State the local-first scope and what is still missing |

The table is a coordination template, not platform policy. Reorder or skip a channel when its rules, audience, or account readiness make the post a poor fit. Avoid asking people to star, upvote, or review in exchange for rewards.

## Community follow-through

- **AMA:** Schedule only after confirming subreddit rules and choosing a technical topic; use the static compiler or local MCP boundary as the subject.
- **Live coding:** Show setup, AML validation, and a safe API read. Do not imply the UI screenshot is live telemetry.
- **Office hours:** Pick a recurring time and public video link before advertising a weekly commitment. Publish notes and unanswered questions afterward.
- **Feature prioritization:** Use GitHub Issues and Discussions. Ask contributors to react to existing proposals; summarize the reasoning and tradeoffs in a maintainer comment.
- **Bug bounty:** No bounty is currently offered. Define scope, budget, eligibility, disclosure timeline, and payment process before advertising one. Until then, use `SECURITY.md` for coordinated disclosure.
- **Contributor recognition:** Ask before publishing a person's name, quote, or screenshot. Credit contributions using public GitHub history.

## Partnerships, grants, and discovery

- Look for projects whose maintainers have a concrete integration use case; propose a small adapter or compatibility test rather than a broad partnership announcement.
- Verify program eligibility, deadlines, funding terms, and maintenance obligations before applying to GitHub Sponsors, NLnet, Mozilla, or other programs.
- Submit to directories only when the listing is accurate, maintained, and useful to the directory's audience. Track the canonical listing and update date.
- Pitch podcasts, newsletters, conferences, and workshops with a specific technical angle and a reproducible demo. Never imply acceptance or endorsement before it is confirmed.
- Publish comparison content only with a transparent feature matrix, sources, and clear differences in project maturity. Do not make unsupported performance or superiority claims.

## Measurement after launch

Record a baseline and review it after 24 hours, 7 days, and 30 days. Prefer first-party observations the project can actually access: release downloads, referral sources if configured with consent, issue quality, repeat contributors, and setup failures reported by users. Do not infer search ranking from GitHub stars or claim that an indexer visited without logs or evidence.
