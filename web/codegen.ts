// GraphQL Code Generator: reads the AppSync schema + every graphql(`...`) operation in web/src and writes
// typed documents to src/gql. A typo in a field name becomes a TYPE error, not a runtime surprise.
// Run: pnpm --filter @ticketlite/web codegen (also runs before typecheck, test and build).
// CONCEPT: graphql-client
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: ["../graphql/schema.graphql", "../graphql/appsync-builtins.graphql"],
  documents: ["src/**/*.{ts,tsx}", "!src/gql/**"],
  generates: {
    "src/gql/": {
      preset: "client",
      // documentMode "string": operations become plain typed strings, so the app needs no GraphQL
      // runtime library at all (we send them with fetch / a WebSocket ourselves).
      config: { documentMode: "string", scalars: { AWSDateTime: "string" }, enumsAsTypes: true },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
