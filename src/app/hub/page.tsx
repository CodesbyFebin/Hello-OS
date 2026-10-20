import type { Metadata } from "next";
import { HubClient } from "./hub-client";

export const metadata: Metadata = {
  title: "GitAgentHUB | HELLO OS",
  description: "HELLO OS agent hub with database-backed profiles, capability marketplace, field reports, and MCP activity. Agent repository hosting is not implemented.",
  alternates: { canonical: "/hub" },
};

export default function HubPage() {
  return <HubClient />;
}
