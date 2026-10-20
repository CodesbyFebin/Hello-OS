import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const src = new URL("../src/", import.meta.url);
export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = new URL(spec.slice(2), src).href;
  if ((spec.startsWith("file:") || spec.startsWith(".")) && !/\.[cm]?[jt]sx?$/.test(spec)) {
    const base = spec.startsWith("file:") ? spec : new URL(spec, context.parentURL).href;
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(fileURLToPath(base + ext))) return next(pathToFileURL(fileURLToPath(base + ext)).href, context);
    }
  }
  return next(spec, context);
}

