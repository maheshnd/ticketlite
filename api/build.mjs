// Bundles the Lambda entry point into ONE file: dist/index.js.
// Why bundle? Lambda then loads a single file instead of thousands in node_modules,
// so the upload is small and cold starts are faster.
import { build } from "esbuild";
import { statSync } from "node:fs";

await build({
  entryPoints: ["src/lambda.ts"], // the Lambda wrapper, not local.ts
  outfile: "dist/index.js", // file "index" + export "handler" = handler "index.handler"
  bundle: true, // inline fastify and every other dependency
  platform: "node", // keep Node built-ins (fs, http, ...) as require() calls
  target: "node24", // match the Lambda runtime nodejs24.x
  format: "cjs", // CommonJS: the simplest format for Lambda to load
  sourcemap: false, // keep the zip small; turn on later if stack traces get hard to read
});

// Print the size so we notice if the bundle suddenly grows.
const kb = (statSync("dist/index.js").size / 1024).toFixed(1);
console.log(`built dist/index.js (${kb} KB)`);
