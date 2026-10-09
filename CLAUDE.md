# TicketLite

A small learning app for mastering AWS serverless for lead-level interviews.
The owner studies every file, so code must be simple, readable and well-commented.

## Project layout
The full spec is `BUILD-SPEC.md`; build progress (and where to resume) is `PROGRESS.md`.

- `packages/shared/` — Zod schemas + TS types shared by api, functions and web (exports `src/index.ts`, no build step)
- `api/` — Fastify app in TypeScript. Runs locally (`src/local.ts`) and inside Lambda (`src/lambda.ts`). Bundled by esbuild to `api/dist/index.js`.
- `functions/` — standalone single-job Lambdas, one folder each
- `web/` — Next.js frontend (static export)
- `graphql/` — AppSync schema + JS resolvers
- `e2e/` — Playwright tests
- `infra/` — Pulumi TypeScript project, stack `dev`, region `us-east-1`. No `aws:profile` in config: credentials come from the environment.
- `bootstrap/` — separate Pulumi project (stack `dev`). Creates the GitHub OIDC provider and the two CI roles. The owner runs it once.
- `packages/sql/` — optional SQL reporting (Drizzle schema, migrations, reports)
- `scripts/` — one-off scripts run with tsx (seed data, local tables, local search index)
- `.github/workflows/` — `ci.yml` (PR checks + read-only preview), `deploy.yml` (deploy on main), `destroy.yml` (manual teardown)
- `docs/` — setup guides, concept map, ADRs, runbook
- `notes/` — study notes per phase
- `SERVICE-MAP.md` — every AWS service in use → files → why

The repo is **one pnpm workspace** (`pnpm-workspace.yaml`, one root `pnpm-lock.yaml`). Run `pnpm install` at the root.
Package names are `@ticketlite/<folder>`; run one package's script with `pnpm --filter @ticketlite/api <script>`.
Local dev: `pnpm dev` (offline, or connected after `pnpm dev:env`), `pnpm dev:mock` (no AWS, no Docker); see README "Local development".
Root scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:coverage`, `pnpm e2e`, `pnpm build` (`pnpm build:bundles` = only what Pulumi needs, no web), `pnpm format`, `pnpm check:concepts`, `pnpm db:local`.
Every `// CONCEPT: <tag>` in code must be listed in `docs/CONCEPT-MAP.md` (`pnpm check:concepts`, run in CI).

## Rules
- **Simplicity first.** One job per file, short files, flat folders. No clever abstractions, extra layers or DI frameworks.
- **Comments.** Every file gets short step-by-step comments explaining WHY, not just what.
- **TypeScript strict mode** everywhere. **pnpm only** (10.33.2, the same in CI). Node 24 everywhere: the laptop, CI, `@types/node`, the esbuild target and the Lambda runtime `nodejs24.x`.
- **Versions.** Use current stable versions of libraries, GitHub Actions and Pulumi AWS provider APIs. Check them with `npm view`, `gh api`, or the installed `.d.ts` files instead of assuming.
  - TypeScript 7 (native) ships no JS API, so nothing here uses it:
    - App packages use **TypeScript 6.0.x** (root devDependency), because typescript-eslint (`<6.1`) and Next.js need the JS API.
    - `infra/` and `bootstrap/` stay on **TypeScript 5.9.x**, because Pulumi's Node runtime needs it (`<7`).
  - **ESLint 10** (flat config, `eslint.config.mjs` at the root). `eslint-plugin-jsx-a11y` 6.10.2 says it supports ESLint ≤9, but it works under 10 (checked). Ignore its peer warning.
  - **Vitest 5** needs `vite` installed as a peer (root devDependency).
  - App packages use `"module": "preserve"` + `"moduleResolution": "bundler"` (`tsconfig.base.json`): tsc never emits JS, so imports have no `.js` suffix.
  - Prettier formats code only. Markdown is hand-formatted (`.prettierignore`).
  - AppSync resolvers: `@aws-appsync/eslint-plugin` doesn't support ESLint 10 / TS 6. Check resolvers with `AWS_PROFILE=ticketlite pnpm --filter @ticketlite/graphql evaluate` (read-only `aws appsync evaluate-code`). APPSYNC_JS has no try/catch, throw, `++` or classes.
  - MSW 3: GraphQL mocks come from `msw/graphql` via `graphql.link(url)`; the option is `onUnhandledFrame` (not `onUnhandledRequest`). `msw/browser` maps to null for Node, so the browser worker is loaded with `next/dynamic` + `ssr: false` (`web/src/components/MockGate.tsx`).
  - Next.js 16 `next dev` writes `web/AGENTS.md` (Next's own agent notes) and re-creates it if deleted. It is committed on purpose so `pnpm dev` doesn't dirty the tree.
  - pnpm creates "peer variants" of vitest; a package using `@testing-library/jest-dom` must declare `vitest` itself (see `web/package.json`), or the matcher types attach to another copy.
- **Infra structure.** One Pulumi file per service area (`infra/iam.ts`, `infra/lambdas.ts`, `infra/http-api.ts`, …). `index.ts` only wires them together and exports outputs.
- **Cost safety.** CloudWatch log groups get 7-day retention. API throttling limits stay low. IAM is least-privilege.
- **Deploys happen ONLY through GitHub Actions** on merge to `main`.
  - Locally, the only allowed Pulumi command is `AWS_PROFILE=ticketlite pulumi preview` (in `infra/` or `bootstrap/`).
  - The `ticketlite` AWS profile is an IAM user with an access key (no SSO / Identity Center). Always pass credentials as `AWS_PROFILE=ticketlite`; never suggest SSO login commands.
  - **Never run `pulumi up` or `pulumi destroy`** locally. The one exception is `bootstrap/`, which the owner runs once by hand. Claude never runs it.
  - Nothing in `infra/` may assume a laptop (no profiles, no local paths outside the repo).
- **Secrets.** Never put secrets in code or env vars. Never commit `dist/` or `.env`. CI secrets live in GitHub settings only.
- **SERVICE-MAP.md.** Update it in every task that adds, removes or changes how an AWS service is used.
