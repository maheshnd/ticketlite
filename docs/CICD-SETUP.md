# CI/CD one-time setup

After these steps, **GitHub Actions is the only thing that deploys TicketLite**:
- Pull request to `main` (`ci.yml`): format, lint, typecheck, tests, build, then a `pulumi preview` posted as a PR comment, using a read-only AWS role.
- Merge (push) to `main` (`deploy.yml`): `pulumi up` with the deploy role, then the web app is uploaded to S3, CloudFront is invalidated and a smoke test runs.
- Manual **destroy** workflow: tears the `dev` stack down to save cost.

You do steps 1–5 once, in this order.

## 0. Before you start
```bash
pulumi whoami                       # logged in to Pulumi Cloud?
AWS_PROFILE=ticketlite aws sts get-caller-identity   # do the ticketlite IAM user's access keys work?
gh auth status                      # GitHub CLI logged in as maheshnd?
```

## 1. Create the GitHub repo and push
The milestones are already committed on local `main` (`dist/`, `node_modules/` and `.env` are git-ignored).
Check with `git status` (clean) and `git log --oneline`.

```bash
cd ~/Code/ticketlite

# Repo doesn't exist yet:
gh repo create maheshnd/ticketlite --private --source . --remote origin --push
# Repo already exists (created on github.com):
git remote add origin https://github.com/maheshnd/ticketlite.git && git push -u origin main
```

> **Expected:** this push starts the `deploy` workflow, and it **fails** at "configure-aws-credentials" because the roles and variables don't exist yet. That's fine. You re-run it in step 5.

## 2. Run the bootstrap locally (the ONLY `pulumi up` you ever run)
It creates the GitHub OIDC provider plus two IAM roles: `preview` (read-only, PRs) and `deploy` (admin, main only).

```bash
pnpm install                                  # at the repo root: one install for the whole workspace
cd bootstrap
pulumi stack select dev                       # the stack already exists in Pulumi Cloud
AWS_PROFILE=ticketlite pulumi preview         # expect: + 6 to create
AWS_PROFILE=ticketlite pulumi up              # review, then choose "yes"
pulumi stack output                           # shows previewRoleArn and deployRoleArn
```

## 3. Create a Pulumi access token for CI
1. Go to https://app.pulumi.com → your avatar (top right) → **Personal access tokens** → **Create token**.
2. Name it `github-actions-ticketlite` and pick an expiry (e.g. 90 days, then rotate).
3. Copy the token now. It is shown only once.

## 4. Add the secret and the two variables in GitHub
In the browser: **repo → Settings → Secrets and variables → Actions**.

| Tab | Name | Value |
|---|---|---|
| Secrets | `PULUMI_ACCESS_TOKEN` | the token from step 3 |
| Variables | `AWS_PREVIEW_ROLE_ARN` | `previewRoleArn` from step 2 |
| Variables | `AWS_DEPLOY_ROLE_ARN` | `deployRoleArn` from step 2 |

Role ARNs are not secret (they're useless without a valid GitHub token), so they're variables. The Pulumi token is a real credential, so it's a secret.

The same from the terminal (run inside `bootstrap/`):
```bash
gh secret set PULUMI_ACCESS_TOKEN --repo maheshnd/ticketlite        # paste the token when asked
gh variable set AWS_PREVIEW_ROLE_ARN --repo maheshnd/ticketlite --body "$(pulumi stack output previewRoleArn)"
gh variable set AWS_DEPLOY_ROLE_ARN  --repo maheshnd/ticketlite --body "$(pulumi stack output deployRoleArn)"
```

## 5. Trigger the first deploy
Either:
- **GitHub → Actions → deploy → Run workflow** (branch `main`), or
- `gh workflow run deploy.yml --repo maheshnd/ticketlite --ref main`, then `gh run watch`.

When it is green:
```bash
cd infra
curl "$(pulumi stack output cloudFrontUrl)/api/health"   # {"status":"ok","stage":"dev"}
open "$(pulumi stack output cloudFrontUrl)"               # the web app
```

### After the first deploy (once)
1. **Confirm two emails** sent to `mahesh.deshmukh.tech@gmail.com`: the SES identity verification and the SNS
   subscription to `admin-notifications`. Until then SES can't send and SNS won't deliver.
2. **Seed sample data:** GitHub → Actions → **seed** → Run workflow.
3. **Set the payment signing secret** (any random string; never commit it):
   ```bash
   aws secretsmanager put-secret-value --secret-id "$(pulumi stack output paymentSecretArn)" --secret-string "$(openssl rand -hex 32)"
   ```
4. **Make yourself admin:** sign up in the app, then
   `aws cognito-idp admin-add-user-to-group --user-pool-id "$(pulumi stack output userPoolId)" --username <your email> --group-name admin`

### Optional flags (each costs money; see docs/COSTS.md)
- `enableCache`: create a free database at upstash.com, set `ticketlite-infra:enableCache: true` in
  `infra/Pulumi.dev.yaml`, merge, then `aws secretsmanager put-secret-value --secret-id "$(pulumi stack output redisSecretArn)" --secret-string 'rediss://default:<password>@<host>:6379'`.
- `enableSearch`: set it to `true` and merge (the domain takes ~15-20 min to create). Then backfill existing events
  by touching them, or re-run the seed workflow (each write flows through the stream into the index).

### Try the PR flow
```bash
git switch -c test-preview && git commit --allow-empty -m "test preview" && git push -u origin test-preview
gh pr create --fill
```
The PR gets a comment with the `pulumi preview` output. Merging it runs the deploy.

## Day to day
- Change code → open a PR → read the preview comment → merge → CI deploys.
- Locally you may only run `AWS_PROFILE=ticketlite pulumi preview` (run `pnpm build` at the repo root first).
- Done studying for a while? **Actions → destroy → Run workflow**, type `destroy`. Run **deploy** manually to bring everything back.

## A future `prod` stack (not built)

1. `cd infra && pulumi stack init prod`, then copy `Pulumi.dev.yaml` to `Pulumi.prod.yaml` and adjust (tags `stage: prod`,
   introspection off, real emails, maybe `enableWaf: true`). Resource names include the stack, so dev and prod coexist.
2. Ideally a **separate AWS account** for prod (AWS Organizations), with its own bootstrap stack and roles.
3. In GitHub: **Settings → Environments → New environment `prod`**, add **required reviewers** (and optionally a wait
   timer and "deployment branches: main"). Put `AWS_DEPLOY_ROLE_ARN` for prod in that environment's variables.
4. A `deploy-prod` job in `deploy.yml` with `needs: deploy`, `environment: prod` and `stack-name: prod`. GitHub pauses it
   until a reviewer approves, after dev's smoke tests passed.
5. **The OIDC trust changes:** a job with `environment: prod` gets the token subject `repo:maheshnd/ticketlite:environment:prod`
   (not `ref:refs/heads/main`), so the prod deploy role must trust that `sub`.

## If something fails
- **`Not authorized to perform sts:AssumeRoleWithWebIdentity`**: the token's `sub` didn't match the trust policy. Usual causes: the workflow ran from a branch other than `main` (for deploy or destroy), the repo was renamed (update `githubRepo` in `bootstrap/Pulumi.dev.yaml`, then re-run step 2), or a job uses a GitHub `environment:` (that changes the `sub`).
- **`Credentials could not be loaded`** or an empty role ARN: the repository variables from step 4 are missing or misspelled.
- **Pulumi `unauthorized`**: the `PULUMI_ACCESS_TOKEN` secret is missing or has expired.
