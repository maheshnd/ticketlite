# e2e

Playwright tests. Two kinds:

| Config | Runs against | What |
|---|---|---|
| `playwright.config.ts` (`tests/`) | The static site built in **mock mode** (`NEXT_PUBLIC_MOCK=1`: MSW answers every API, GraphQL and WebSocket call inside the browser), served by `serve.mjs` with the same URL rewrite as CloudFront | Visitor, user and admin journeys + axe (WCAG 2.1 AA) on every main page |
| `playwright.smoke.config.ts` (`smoke/`) | The real deployment (`BASE_URL` = CloudFront URL, set by `deploy.yml`) | Read-only: `/api/health`, security headers, home page, axe |

```bash
pnpm e2e                                        # build mock mode + run the journeys (from the repo root)
pnpm --filter @ticketlite/e2e exec playwright install chromium   # once, for the browser
BASE_URL=https://dxxxx.cloudfront.net pnpm --filter @ticketlite/e2e smoke
```

The mock handlers are the same ones the component tests use (`web/src/mocks/handlers.ts`); the mock user
`test@ticketlite.dev` / `Tickets2026x` is an admin.
