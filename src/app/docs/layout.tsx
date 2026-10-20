import "./docs.css";
import { HubShell } from "@/components/hub/hub-shell";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <HubShell active="docs">{children}</HubShell>;
}
