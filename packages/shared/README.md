# packages/shared

Zod schemas and the TypeScript types inferred from them, shared by `api/`, `functions/` and `web/`.

- **Why one place?** The API validates a request with the same schema the web form uses, so the two can never drift apart.
- **No build step.** `package.json` exports `src/index.ts` directly. esbuild, tsx, Vitest and Next.js all compile TypeScript themselves.
- **Test:** `pnpm --filter @ticketlite/shared test`
