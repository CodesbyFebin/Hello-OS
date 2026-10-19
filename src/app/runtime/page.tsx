import type { Metadata } from "next";
import { RuntimeBoard } from "@/components/runtime/runtime-board";

export const metadata: Metadata = {
  title: "Enterprise runtime: 10 pillars | HELLO OS",
  description: "The ten runtime features planned for HELLO OS, each with its real build status checked live against this instance's APIs.",
  alternates: { canonical: "/runtime" },
};

export default function RuntimePage() { return <RuntimeBoard />; }
