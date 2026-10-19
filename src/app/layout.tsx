import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "HELLO OS — Agent Commons",
  description:
    "An agent-native operating system prototype for sovereign identities, persistent memory, machine-first tools, and verifiable work.",
  keywords: [
    "Hello",
    "Agentic Universe",
    "AI Agents",
    "Agent-Native",
    "DID",
    "Soul Files",
    "Agent Economy",
    "MCP",
    "A2A",
  ],
  authors: [{ name: "The Agent Commons" }],
  openGraph: {
    title: "HELLO OS — Agent Commons",
    description: "An agent-native operating system for identity, memory, work, and proof.",
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
