import { ROUTE_MANIFEST } from "./route-manifest";
import { DOC_PAGES } from "./content";
import { LLMS_BASE } from "./llms-base";

export type RouteManifest = { pages: { path: string }[]; api: { path: string; methods: string[] }[] };
export const ROUTES: RouteManifest = { pages: [...ROUTE_MANIFEST.pages], api: ROUTE_MANIFEST.api.map((r) => ({ path: r.path, methods: [...r.methods] })) };

/** Routes without dynamic segments, for linking. Dynamic ones are listed as patterns. */
const isStatic = (p: string) => !p.includes("[");

export function buildLlmsTxt(site: string, routes: RouteManifest = ROUTES) {
  const u = site.replace(/\/$/, "");
  const lines = [LLMS_BASE.trimEnd(), "", "## Docs (this instance)",
    ...DOC_PAGES.map((p) => `- [${p.question}](${u}/docs/${p.slug}): ${p.description}`),
    "", "## Pages served by this app (generated from src/app)",
    ...routes.pages.filter((r) => !r.path.startsWith("/docs/")).map((r) => `- ${isStatic(r.path) ? `${u}${r.path}` : r.path}`),
    "", "## HTTP API routes (generated from src/app; methods as exported)",
    ...routes.api.map((r) => `- ${r.methods.join(",") || "?"} ${r.path}`),
    "", "Status labels used in /docs: implemented = real route; prototype = partial or simulated; vision = design only.", ""];
  return lines.join("\n");
}

export function docsCardExtension(site: string, routes: RouteManifest = ROUTES) {
  const u = site.replace(/\/$/, "");
  return {
    llmsTxt: `${u}/llms.txt`,
    docs: DOC_PAGES.map((p) => ({ title: p.title, url: `${u}/docs/${p.slug}` })),
    pages: routes.pages.map((r) => r.path),
    api: routes.api,
    note: "Generated from the routes in src/app. Listing a route grants no authorization.",
  };
}
