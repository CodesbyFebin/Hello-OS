import type { Metadata } from "next";
import IntegrationsClient from "./integrations-client";

export const metadata: Metadata = {
  title: "Integrations registry | HELLO OS",
  description: "100 proposed connectors for HELLO OS. Each is tagged WORKING (implemented and tested here), PLANNED, or VISION.",
  alternates: { canonical: "/integrations" },
};

export default function IntegrationsPage() {
  return <IntegrationsClient />;
}
