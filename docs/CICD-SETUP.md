# CI/CD one-time setup

After these steps, **GitHub Actions is the only thing that deploys TicketLite**:
- Pull request to `main`: CI builds, typechecks and posts a `pulumi preview` as a PR comment, using a read-only AWS role.
- Merge (push) to `main`: CI runs `pulumi up`, using the deploy role.
- Manual **destroy** workflow: tears the `dev` stack down to save cost.

You do steps 1–5 once, in this order.

## 0. Before you start
```bash
pulumi whoami                       # logged in to Pulumi Cloud?
aws sts get-caller-identity --profile ticketlite   # AWS session still valid? If not: aws login --profile ticketlite
gh auth status                      # GitHub CLI logged in as maheshnd?
```

## 1. Create the GitHub repo and push
Commit everything on `main` first (`dist/`, `node_modules/` and `.env` are git-ignored).

```bash
cd ~/Code/ticketlite
git add -A && git commit -m "phase 1: fastify lambda + CI/CD via GitHub Actions"

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
curl "$(pulumi stack output apiUrl)/health"       # {"status":"ok"}
```

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

## If something fails
- **`Not authorized to perform sts:AssumeRoleWithWebIdentity`**: the token's `sub` didn't match the trust policy. Usual causes: the workflow ran from a branch other than `main` (for deploy or destroy), the repo was renamed (update `githubRepo` in `bootstrap/Pulumi.dev.yaml`, then re-run step 2), or a job uses a GitHub `environment:` (that changes the `sub`).
- **`Credentials could not be loaded`** or an empty role ARN: the repository variables from step 4 are missing or misspelled.
- **Pulumi `unauthorized`**: the `PULUMI_ACCESS_TOKEN` secret is missing or has expired.
