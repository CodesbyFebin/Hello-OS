import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // QuickJS ships its own .wasm; load it from node_modules at runtime.
  serverExternalPackages: ["quickjs-emscripten", "ts-morph"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
