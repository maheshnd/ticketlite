// Bundles every function folder that has a handler.ts into <folder>/dist/index.js (one zip per Lambda).
// One bundle per function keeps each Lambda small and lets each one load only the code it uses.
// CONCEPT: cold-start
import { build } from "esbuild";
import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const folders = readdirSync(".").filter((name) => existsSync(join(name, "handler.ts")));

for (const folder of folders) {
  rmSync(join(folder, "dist"), { recursive: true, force: true });
  await build({
    entryPoints: [join(folder, "handler.ts")],
    outfile: join(folder, "dist", "index.js"), // Lambda handler "index.handler"
    bundle: true,
    platform: "node",
    target: "node24", // the Lambda runtime nodejs24.x
    format: "cjs",
    minify: true,
    sourcemap: true, // the Lambdas set NODE_OPTIONS=--enable-source-maps
  });
  // sql-reporter applies SQL migrations at runtime, so the .sql files must ship next to the bundle.
  if (folder === "sql-reporter")
    cpSync("../packages/sql/migrations", join(folder, "dist", "migrations"), { recursive: true });
  const kb = (statSync(join(folder, "dist", "index.js")).size / 1024).toFixed(1);
  console.log(`built ${folder}/dist/index.js (${kb} KB)`);
}
