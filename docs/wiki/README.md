# HELLO OS Wiki source

This directory contains evidence-led pages formatted for import into the GitHub Wiki. The repository remains the canonical source for code, API schemas, and release status. Update these pages when the implementation changes; do not copy claims from old concept art or unverified planning documents.

## Publishing to the GitHub Wiki

GitHub Wiki pages live in a separate `OWNER/REPOSITORY.wiki.git` repository. These files are prepared for that format (`Home.md`, `_Sidebar.md`, and one Markdown file per page), but must be copied to the Wiki repository to appear at `github.com/CodesbyFebin/Hello-OS/wiki`. The GitHub repository file API used for ordinary source files does not publish Wiki pages.

1. Clone the Wiki repository using an account with repository write access.
2. Copy the Markdown files from this directory into the Wiki checkout.
3. Review each page and link against the current default branch, then commit and push.
4. Confirm the page renders and its links work on GitHub before announcing it.

Do not create staged discussion threads or synthetic testimonials. Community posts must be authored by real contributors and identify simulations or estimates as such.

## Page map

- [Home](Home.md)
- [Quickstart](Quickstart.md)
- [Architecture](Architecture.md)
- [AML](AML.md)
- [Protocols and API](Protocols-and-API.md)
- [Benchmarks and evidence](Benchmarks-and-Evidence.md)
- [Community and UGC](Community-and-UGC.md)
- [Roadmap](Roadmap.md)
- [_Sidebar](%5FSidebar.md)
