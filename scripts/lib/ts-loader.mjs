import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
async function exists(url) {
  try { await access(fileURLToPath(url)); return true; } catch { return false; }
}

export async function resolve(specifier, context, nextResolve) {
  let target = null;
  if (specifier.startsWith("@/")) target = path.join(root, specifier.slice(2));
  if (target) {
    for (const candidate of [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts"), path.join(target, "index.tsx")]) {
      const url = pathToFileURL(candidate).href;
      if (await exists(url)) return { url, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
