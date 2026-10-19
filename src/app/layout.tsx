import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "HELLO Agentic OS — Agent Identity, Memory & MCP Workspace",
  description:
    "HELLO OS is a local-first agentic operating system prototype with agent identity, persistent memory, MCP tools, A2A-style tasks, and a self-hosted dashboard.",
  keywords: [
    "Hello",
    "Agentic OS",
    "AI Agents",
    "Agent-Native",
    "DID",
    "Soul Files",
    "Agent Economy",
    "MCP",
    "A2A",
  ],
  openGraph: {
    title: "HELLO Agentic OS — Identity, Memory & MCP",
    description: "A local-first agentic OS prototype for agent identity, memory, MCP tools, A2A-style tasks, and inspectable work.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
