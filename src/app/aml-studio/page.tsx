import type { Metadata } from "next";
import { AmlStudioClient } from "./aml-studio-client";

export const metadata: Metadata = {
  title: "AML Studio | HELLO OS",
  description: "Write and statically validate Agent Machine Language in HELLO OS. Inspect parsed declarations, an intent graph, diagnostics, budgets, and SHA-256 hashes. AML is not executed.",
  alternates: { canonical: "/aml-studio" },
};

export default function AmlStudioPage() {
  return <AmlStudioClient />;
}
