import type { DocPage } from "./content";

const REPO = "https://github.com/CodesbyFebin/Hello-OS";
const author = { "@type": "Person", name: "CodesbyFebin", url: "https://github.com/CodesbyFebin" };

export function softwareApplication(site: string) {
  return {
    "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: "HELLO Agentic OS", applicationCategory: "DeveloperApplication", operatingSystem: "Linux, macOS, Windows (Node.js)",
    description: "Local-first, open-source agentic OS prototype: agent identity, tiered memory, missions, MCP tools and credit wallets.",
    url: `${site}/docs`, license: "https://opensource.org/licenses/MIT", isAccessibleForFree: true, author, sameAs: REPO,
  };
}

export function techArticle(site: string, p: DocPage) {
  return {
    "@context": "https://schema.org", "@type": "TechArticle",
    headline: p.question, description: p.description, abstract: p.answer,
    url: `${site}/docs/${p.slug}`, inLanguage: "en", author, license: "https://opensource.org/licenses/MIT",
    isPartOf: { "@type": "WebSite", name: "HELLO OS docs", url: `${site}/docs` },
    about: { "@type": "SoftwareApplication", name: "HELLO Agentic OS", url: REPO },
  };
}
