// Vitest settings for the api package. Tests call the app in memory with app.inject(): no port, no AWS.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { LOG_LEVEL: "silent", STAGE: "test" }, // quiet logs; "test" keeps local-only plugins (CORS, docs) off
  },
});
