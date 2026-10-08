// Bundles the Lambda entry point into ONE file: dist/index.js.
// Why bundle? Lambda then loads a single file instead of thousands in node_modules,
// so the upload is small and cold starts are faster. CONCEPT: cold-start
import { build } from "esbuild";
import { cpSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Step 1: start from an empty dist/ so no stale files get uploaded.
rmSync("dist", { recursive: true, force: true });

// Step 2: bundle.
await build({
  entryPoints: ["src/lambda.ts"], // the Lambda wrapper, not local.ts
  outfile: "dist/index.js", // file "index" + export "handler" = handler "index.handler"
  bundle: true, // inline fastify and every other dependency
  platform: "node", // keep Node built-ins (fs, http, ...) as require() calls
  target: "node24", // match the Lambda runtime nodejs24.x
  format: "cjs", // CommonJS: the simplest format for Lambda to load
  minify: true, // smaller file = faster cold start; the sourcemap keeps stack traces readable
  sourcemap: true, // used because the Lambda sets NODE_OPTIONS=--enable-source-maps
  // We bundle the AWS SDK too, although the runtime ships one: then the version is the one in our
  // lockfile (the same one the tests ran against), not whatever the runtime happens to have today.
});

// Step 3: Swagger UI serves HTML/JS/CSS files from disk, which esbuild cannot inline. Copy them next to the bundle.
const require = createRequire(import.meta.url);
const swaggerUiDir = dirname(require.resolve("@fastify/swagger-ui/package.json"));
cpSync(join(swaggerUiDir, "static"), "dist/static", { recursive: true });

// Print the size so we notice if the bundle suddenly grows.
const kb = (statSync("dist/index.js").size / 1024).toFixed(1);
console.log(`built dist/index.js (${kb} KB)`);
