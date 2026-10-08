// Checks that every `CONCEPT: <tag>` comment in the code is listed in docs/CONCEPT-MAP.md.
// Run: pnpm check:concepts (CI runs it too). It keeps the concept map honest as the code grows.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["node_modules", "dist", "out", ".next", ".git", "coverage", "bin", "notes"]);
const EXTENSIONS = /\.(ts|tsx|js|mjs|graphql|json|yml|yaml)$/;

// Step 1: walk the repo and collect every tag, e.g. "// CONCEPT: cold-start, connection-reuse".
function collect(dir: string, tags: Map<string, string>) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collect(path, tags);
    else if (EXTENSIONS.test(name)) {
      for (const match of readFileSync(path, "utf8").matchAll(/CONCEPT: ([a-z0-9-]+(?:, [a-z0-9-]+)*)/g)) {
        for (const tag of match[1]!.split(", ")) if (!tags.has(tag)) tags.set(tag, path);
      }
    }
  }
}

const tags = new Map<string, string>();
collect(".", tags);

// Step 2: every tag must appear in the map as `tag` (in backticks).
const map = readFileSync("docs/CONCEPT-MAP.md", "utf8");
const missing = [...tags].filter(([tag]) => !map.includes("`" + tag + "`"));

if (missing.length > 0) {
  console.error("These CONCEPT tags are missing from docs/CONCEPT-MAP.md:");
  for (const [tag, file] of missing) console.error(`  ${tag}  (first seen in ${file})`);
  process.exit(1);
}
console.log(`All ${tags.size} CONCEPT tags are in docs/CONCEPT-MAP.md`);
