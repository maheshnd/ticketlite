// drizzle-kit: `pnpm --filter @ticketlite/sql generate` compares src/schema.ts with the previous migrations and
// writes a NEW SQL migration file into migrations/. Migrations are committed and applied in order by
// sql-reporter on cold start (drizzle's migrator records applied ones in a table). CONCEPT: safe-migrations
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
});
