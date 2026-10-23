import type { Metadata } from "next";
import { EcosystemClient } from "./ecosystem-client";

export const metadata: Metadata = {
  title: "HELLO OS Ecosystem",
  description: "Explore the HELLO OS agent ecosystem through live identity, mission, memory, guild, and MCP service data.",
  alternates: { canonical: "/ecosystem" },
};

export default function EcosystemPage() {
  return <EcosystemClient />;
}
