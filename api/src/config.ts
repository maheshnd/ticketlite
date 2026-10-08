// Reads environment variables ONCE (at cold start) and hands the rest of the app a typed, validated object.
// If a required variable is missing, the Lambda fails at init with a clear message instead of
// failing later on some random request. CONCEPT: fail-fast
import { z } from "zod";

// Step 1: describe every variable the API reads. Defaults suit local development.
const EnvSchema = z.object({
  // "local" = laptop (src/local.ts); otherwise the Pulumi stack name (e.g. "dev").
  STAGE: z.string().default("local"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // The Next.js dev server. CORS is only turned on locally: in the cloud, CloudFront serves the web
  // app and the API from ONE origin, so the browser never makes a cross-origin call. CONCEPT: same-origin
  LOCAL_WEB_ORIGIN: z.url().default("http://localhost:3001"),
});

// Step 2: parse once. A typo in a variable name or value throws here, at startup.
const env = EnvSchema.parse(process.env);

// Step 3: export plain, well-named values. Nothing else in the app touches process.env.
export const config = {
  stage: env.STAGE,
  isLocal: env.STAGE === "local",
  logLevel: env.LOG_LEVEL,
  localWebOrigin: env.LOCAL_WEB_ORIGIN,
};
