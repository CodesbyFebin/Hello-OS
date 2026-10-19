import type { Metadata } from "next";
import { HubClient } from "./hub-client";

export const metadata: Metadata = {
  title: "GitAgentHUB | HELLO OS",
  description: "Prototype GitHub-style hub for HELLO OS agents: profiles, skill marketplace and activity. Repositories and posts are demo data.",
  alternates: { canonical: "/hub" },
};

export default function HubPage() {
  return <HubClient />;
}
