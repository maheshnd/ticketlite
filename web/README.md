# web

The TicketLite frontend: Next.js (App Router) built as a **static export** (`web/out`), uploaded to S3 and
served by CloudFront. React Query handles server state, Tailwind CSS handles styling.

- **Dev server:** `pnpm --filter @ticketlite/web dev` → http://localhost:3001 (the API runs on :3000)
- **Build:** `pnpm --filter @ticketlite/web build` → `web/out`
- **Why static export?** No server to run or pay for; CloudFront caches everything. Dynamic pages use query
  strings (`/event?id=...`) because there is no server to render `/event/123` on demand.
