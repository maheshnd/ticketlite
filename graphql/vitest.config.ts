// Vitest for the resolvers. @aws-appsync/utils only exists inside AppSync, so tests replace it with
// small fakes (resolvers/test-utils.ts). The real runtime check is `pnpm --filter @ticketlite/graphql evaluate`.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: {} });
