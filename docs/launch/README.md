# HELLO OS launch kit

This folder is the working source for an honest, coordinated launch. The launch date is **not scheduled**. Public distribution should begin only after the maintainer chooses a date, confirms the built revision and download paths, and sets up a real email-list provider if collecting addresses.

## Verified product description

HELLO OS is a local-first, self-hostable prototype for inspecting agent identity records, missions, memory, selected MCP interactions, internal ledger records, and statically compiled AML intent graphs. It uses Next.js, Prisma, SQLite, and a separate Bun MCP service.

Important boundaries: there is no hosted model-provider runtime, general-purpose agent execution engine, on-chain wallet settlement, isolated microVM workload runtime, managed multi-tenant service, or production authentication. AML is non-executable. The `/evolve` view and dashboard showcase image are simulations or synthetic artwork.

## Launch readiness

- [x] MIT license is present.
- [x] README documents working behavior and prototype limits.
- [x] GitHub Pages download portal links source and real release assets.
- [x] CI and GitHub contribution templates are present in the repository.
- [ ] Add a persistent database, authentication, and MCP service before calling hosted APIs production-ready.
- [ ] Choose a custom production domain and verify canonical URLs, sitemap, and crawler responses.
- [ ] Configure a consent-based email-list provider and test unsubscribe/export/deletion before publishing a signup form.
- [ ] Create and verify downloadable platform artifacts before advertising APK, EXE, DEB, or installer builds.
- [ ] Confirm dates, availability, listing assets, account access, and each platform's current submission rules.

## Suggested four-hour coordination window

Choose one window that overlaps Europe and North America, then schedule a single factual announcement across channels. The exact launch time remains a maintainer decision. Do not purchase engagement, ask people to mass-star, or post the same copy where communities prohibit promotion. Use the channel drafts in [campaign copy](campaign-copy.md) and adapt to each community's rules.

## Email-list target

The 500-subscriber number is a goal, not a forecast. There is no functioning signup endpoint or email provider in this repository. Do not collect addresses in an in-memory store, SQLite file on an ephemeral host, GitHub issue, or public spreadsheet. Use a provider with consent text, double opt-in, export/deletion, unsubscribe handling, and a privacy notice; then wire it as an explicit integration and test its failure path.

## Outreach and directory tracking

Use [outreach tracker](outreach-tracker.csv) to record only public professional contact channels and relevant context. Personalize every approach, respect opt-outs, and do not send bulk unsolicited messages. Use [discovery tracker](discovery-tracker.csv) for directories, podcasts, grants, and events. Record submission dates, eligibility, source URLs, and outcomes rather than asserting an unearned listing.

## Files

- [Two-week content calendar](content-calendar.md)
- [Launch operations checklist](launch-ops.md)
- [Platform launch copy and X thread](campaign-copy.md)
- [Press-kit source](press-kit-one-pager.md)
- [Press-kit PDF](press-kit-one-pager.pdf)
- [Influencer outreach tracker](outreach-tracker.csv)
- [Directory, grant, and event tracker](discovery-tracker.csv)
