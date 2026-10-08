// Small fakes for @aws-appsync/utils, used by the resolver unit tests. util.error and util.unauthorized
// stop the resolver in AppSync; here they throw so a test can assert on them.
import { vi } from "vitest";

export const fakeUtils = () => ({
  util: {
    dynamodb: { toMapValues: (v: unknown) => v },
    time: { nowISO8601: () => "2026-10-08T10:00:00.000Z" },
    autoId: () => "generated-id",
    error: vi.fn((message: string, type?: string) => {
      throw Object.assign(new Error(message), { type });
    }),
    unauthorized: vi.fn(() => {
      throw new Error("Unauthorized");
    }),
  },
});
