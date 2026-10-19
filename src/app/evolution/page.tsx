import type { Metadata } from "next";
import { EvolutionLabClient } from "./evolution-lab-client";

export const metadata: Metadata = {
  title: "Evolution Lab | HELLO OS",
  description: "Inspect HELLO OS agent, apprenticeship, and curriculum data from its APIs. A read-only developer view; it does not train models or spawn virtual machines.",
  alternates: { canonical: "/evolution" },
};

export default function EvolutionLabPage() {
  return <EvolutionLabClient />;
}
