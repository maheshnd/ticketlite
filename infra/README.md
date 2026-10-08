# infra

The Pulumi program for TicketLite (stack `dev`, region `us-east-1`).

- **Deploys:** only through GitHub Actions (`.github/workflows/deploy.yml`) on merge to `main`.
- **Locally:** you may only preview: `AWS_PROFILE=ticketlite pulumi preview`. Run `pnpm build` at the repo root first, because the Lambda code comes from `../api/dist` (and later `../functions/*/dist`).
- **Layout:** one file per service area (`iam.ts`, `lambda.ts`, `api.ts`; renamed in M1 to match BUILD-SPEC §14). `index.ts` only wires them together.
