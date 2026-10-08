// Vitest settings for the api package. Tests call the app in memory with app.inject(): no port, no AWS.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Quiet logs; "test" keeps local-only plugins (CORS, docs) off. Fake AWS credentials let the SDK sign
    // requests (e.g. presigned POSTs) without ever reaching AWS: every AWS call is mocked in the tests.
    env: {
      LOG_LEVEL: "silent",
      STAGE: "test",
      AWS_ACCESS_KEY_ID: "test",
      AWS_SECRET_ACCESS_KEY: "test",
      BOOKING_STATE_MACHINE_ARN: "arn:aws:states:us-east-1:123456789012:stateMachine:booking",
      POSTERS_BUCKET: "posters-test",
    },
  },
});
