# TicketLite

A small learning app for mastering AWS serverless for lead-level interviews.
The owner studies every file, so code must be simple, readable and well-commented.

## Project layout
- `web/` — frontend (later phase)
- `api/` — Fastify app in TypeScript. Runs locally (`src/local.ts`) and inside Lambda (`src/lambda.ts`). Bundled by esbuild to `api/dist/index.js`.
- `functions/` — standalone Lambdas (later phase)
- `infra/` — Pulumi TypeScript project, stack `dev`, region `us-east-1`. No `aws:profile` in config: credentials come from the environment.
- `bootstrap/` — separate Pulumi project (stack `dev`). Creates the GitHub OIDC provider and the two CI roles. The owner runs it once.
- `.github/workflows/` — `deploy.yml` (PR preview, deploy on main) and `destroy.yml` (manual teardown)
- `docs/` — setup guides (`docs/CICD-SETUP.md`)
- `notes/` — study notes per phase
- `SERVICE-MAP.md` — every AWS service in use → files → why

`api/`, `infra/` and `bootstrap/` are separate pnpm projects (each has its own lockfile). There is no root workspace.

## Rules
- **Simplicity first.** One job per file, short files, flat folders. No clever abstractions, extra layers or DI frameworks.
- **Comments.** Every file gets short step-by-step comments explaining WHY, not just what.
- **TypeScript strict mode** everywhere. **pnpm only** (10.33.2, the same in CI). Node 24 everywhere: the laptop, CI, `@types/node`, the esbuild target and the Lambda runtime `nodejs24.x`.
- **Versions.** Use current stable versions of libraries, GitHub Actions and Pulumi AWS provider APIs. Check them with `npm view`, `gh api`, or the installed `.d.ts` files instead of assuming.
  - `infra/` and `bootstrap/` stay on TypeScript 5.x because Pulumi's Node runtime needs TypeScript's JS API, which TS 7 does not ship.
- **Infra structure.** One Pulumi file per service area (`infra/iam.ts`, `infra/lambda.ts`, `infra/api.ts`, …). `index.ts` only wires them together and exports outputs.
- **Cost safety.** CloudWatch log groups get 7-day retention. API throttling limits stay low. IAM is least-privilege.
- **Deploys happen ONLY through GitHub Actions** on merge to `main`.
  - Locally, the only allowed Pulumi command is `AWS_PROFILE=ticketlite pulumi preview` (in `infra/` or `bootstrap/`).
  - **Never run `pulumi up` or `pulumi destroy`** locally. The one exception is `bootstrap/`, which the owner runs once by hand. Claude never runs it.
  - Nothing in `infra/` may assume a laptop (no profiles, no local paths outside the repo).
- **Secrets.** Never put secrets in code or env vars. Never commit `dist/` or `.env`. CI secrets live in GitHub settings only.
- **SERVICE-MAP.md.** Update it in every task that adds, removes or changes how an AWS service is used.
