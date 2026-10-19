import type { Metadata } from "next";
import RoadmapClient from "./roadmap-client";
import { REPO, STEPS } from "@/lib/roadmap/steps";
import { fetchEvidence, resolveStatus } from "@/lib/roadmap/github";

export const metadata: Metadata = {
  title: "HELLO OS 100-step roadmap | HELLO OS",
  description: "100 roadmap steps across 7 layers. Each status comes from repo evidence: code on main, an open PR, planned, or vision.",
  alternates: { canonical: "/roadmap" },
};

export const revalidate = 600;

export default async function RoadmapPage() {
  const evidence = await fetchEvidence(REPO);
  const steps = STEPS.map((s) => {
    const r = resolveStatus(s, evidence.prs);
    return { ...s, status: r.status, prUrl: r.pr?.url ?? (s.pr ? `https://github.com/${REPO}/pull/${s.pr}` : undefined), prMerged: r.pr?.merged ?? false };
  });
  return <RoadmapClient steps={steps} evidence={{ source: evidence.source, fetchedAt: evidence.fetchedAt, events: evidence.events, error: evidence.error }} />;
}