import type { Metadata } from "next";
import { EvolveClient } from "./evolve-client";

export const metadata: Metadata = {
  title: "HELLO EVOLVE Lab (simulation) | HELLO OS",
  description: "A seeded in-browser simulation of evolutionary selection over agent genomes, plus saved evolution runs from the HELLO OS API.",
  alternates: { canonical: "/evolve" },
};

export default function EvolvePage() {
  return <EvolveClient />;
}
