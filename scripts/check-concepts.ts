// Checks that every `CONCEPT: <tag>` comment in the code is listed in docs/CONCEPT-MAP.md.
// Run: pnpm check:concepts (CI runs it too). It keeps the concept map honest as the code grows.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["node_modules", "dist", "out", ".next", ".git", "coverage", "bin", "notes"]);
const EXTENSIONS = /\.(ts|tsx|js|mjs|graphql|json|yml|yaml)$/;
const TAG_LINE = /CONCEPT: ([a-z0-9-]+(?:, [a-z0-9-]+)*)/g;

// Step 1: every source file under `dir`, skipping build output and dependencies.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => !SKIP.has(name))
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return EXTENSIONS.test(name) ? [path] : [];
    });
}

// Step 2: the tags in one file, e.g. "// CONCEPT: cold-start, connection-reuse" -> ["cold-start", "connection-reuse"].
function tagsIn(file: string): string[] {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(TAG_LINE)].flatMap((match) => match[1]!.split(", "));
}

// Step 3: remember where each tag was first seen (for a helpful error message).
const firstSeen = new Map<string, string>();
for (const file of sourceFiles(".")) {
  for (const tag of tagsIn(file)) {
    if (!firstSeen.has(tag)) firstSeen.set(tag, file);
  }
}

// Step 4: every tag must appear in the map as `tag` (in backticks).
const map = readFileSync("docs/CONCEPT-MAP.md", "utf8");
const missing = [...firstSeen].filter(([tag]) => !map.includes("`" + tag + "`"));

if (missing.length > 0) {
  console.error("These CONCEPT tags are missing from docs/CONCEPT-MAP.md:");
  for (const [tag, file] of missing) console.error(`  ${tag}  (first seen in ${file})`);
  process.exit(1);
}
console.log(`All ${firstSeen.size} CONCEPT tags are in docs/CONCEPT-MAP.md`);
