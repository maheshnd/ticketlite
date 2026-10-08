// Vitest for functions/: handlers are plain async functions, called directly with fake events.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      POWERTOOLS_TRACE_ENABLED: "false", // no X-Ray daemon in tests
      POWERTOOLS_LOG_LEVEL: "SILENT",
      EVENTS_TABLE: "Events",
      BOOKINGS_TABLE: "Bookings",
      ORGANIZERS_TABLE: "Organizers",
      SES_EMAIL: "test@ticketlite.dev",
    },
  },
});
