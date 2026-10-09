// Copies MSW's service worker file into the mock-mode static build (web/out). Only the E2E build gets it:
// real builds never contain mock code.
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const mswDir = dirname(require.resolve("msw/package.json"));
copyFileSync(join(mswDir, "lib", "mockServiceWorker.js"), "../web/out/mockServiceWorker.js");
console.log("copied mockServiceWorker.js into web/out");
