# Concept map

Every concept TicketLite demonstrates → the files that show it → how to see it → how to break it.
Search the code for `CONCEPT: <tag>` to find every place a concept appears.

> Filled in milestone by milestone. M7 completes it with all 12 learning topics and backend concepts.

## `CONCEPT:` tags

| Tag | Files | How to see it | How to break it |
|---|---|---|---|
| `schema-validation` | `packages/shared/src/event.ts` | `pnpm --filter @ticketlite/shared test` | Remove `.nonnegative()` from `price`; the "rejects a negative price" test fails |
| `optimistic-locking` | `packages/shared/src/event.ts` | Added in M3 (admin edits) | — |
| `pagination` | `packages/shared/src/pagination.ts` | Added in M2 (events list) | — |
