import type { Metadata } from "next";
import { HubShell } from "@/components/hub/hub-shell";
import { FrontierLab } from "@/components/frontier/frontier-lab";

export const metadata: Metadata = {
  title: "Frontier Lab (vision) | HELLO OS",
  description: "Ten research directions for agent operating systems that are not possible today, each with why not, and a few small labelled in-browser simulations.",
  alternates: { canonical: "/frontier" },
};

export default function FrontierPage() {
  return <HubShell active="frontier"><FrontierLab /></HubShell>;
}
