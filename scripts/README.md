# scripts

One-off TypeScript scripts, run with `tsx` (type-checked by `pnpm typecheck`).

| Script | Run | Does |
|---|---|---|
| `create-local-tables.ts` | `pnpm db:local` (with `seed.ts`) | Creates the DynamoDB tables in DynamoDB Local (mirrors `infra/dynamodb.ts`) |
| `seed.ts` | `pnpm db:local`, or the **seed** workflow in AWS | Upserts 3 organizers and 10 events (one draft). Safe to re-run |
| `index-local-search.ts` | `DYNAMODB_ENDPOINT=http://localhost:8000 pnpm tsx scripts/index-local-search.ts` | Rebuilds the local OpenSearch index from DynamoDB Local |
| `check-concepts.ts` | `pnpm check:concepts` (CI) | Fails if a `CONCEPT:` tag in code is missing from docs/CONCEPT-MAP.md |
| `dynamodb-client.ts` | — | Shared client: DynamoDB Local when `DYNAMODB_ENDPOINT` is set |
