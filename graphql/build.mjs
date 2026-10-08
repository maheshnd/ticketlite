// Bundles each resolver (resolvers/*.ts) into graphql/dist/<name>.js, the code AppSync runs (APPSYNC_JS).
// This is AWS's recommended setup: write TypeScript, bundle with esbuild as ES modules, and leave
// @aws-appsync/utils external (AppSync provides it at runtime).
import { build } from "esbuild";
import { readdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
const entryPoints = readdirSync("resolvers")
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.startsWith("test-"))
  .map((file) => `resolvers/${file}`);

await build({
  entryPoints,
  outdir: "dist",
  bundle: true,
  format: "esm", // APPSYNC_JS expects ES modules (export function request / response)
  target: "esnext",
  platform: "node",
  external: ["@aws-appsync/utils"],
  minify: false, // readable in the AppSync console
});
console.log(`built ${entryPoints.length} resolvers into graphql/dist`);
