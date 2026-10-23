import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // QuickJS ships its own .wasm; load it from node_modules at runtime.
  serverExternalPackages: ["quickjs-emscripten", "ts-morph"],
  // Type errors fail the build (CI also runs `npm run typecheck`).
  typescript: {
    ignoreBuildErrors: false,
  },
  // Don't let `next dev` append generated rules to the project's AGENTS.md.
  agentRules: false,
  reactStrictMode: false,
};

export default nextConfig;
