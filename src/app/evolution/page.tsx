import type { Metadata } from "next";
import { EvolutionLabClient } from "./evolution-lab-client";

export const metadata: Metadata = {
  title: "Evolution Lab | HELLO OS",
  description: "Create and inspect persistent HELLO OS evolution experiments with seeded populations, proxy fitness, mutation, generation history, apprenticeship, and curriculum APIs. Does not train models or alter live agents.",
  alternates: { canonical: "/evolution" },
};

export default function EvolutionLabPage() {
  return <EvolutionLabClient />;
}
