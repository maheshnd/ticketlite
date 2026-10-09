# 0010 — Pulumi (TypeScript) for IaC, GitHub Actions with OIDC as the only deployer

- **Status:** accepted
- **Date:** 2026-10-08

## Context

The infrastructure has ~170 resources across 20 services and must be reproducible, reviewable and destroyable in one
step (cost safety). Deployments must not depend on anyone's laptop or long-lived AWS keys.

## Decision

- **Pulumi with TypeScript** (`infra/`, one file per service area), state in Pulumi Cloud.
- **GitHub Actions is the only deployer**: PRs get a read-only `pulumi preview` (OIDC role trusted only for
  `pull_request` events of this repo); merges to `main` run `pulumi up` (OIDC role trusted only for `refs/heads/main`).
- A separate one-time `bootstrap/` stack creates the OIDC provider and the two roles.

## Alternatives

- **AWS CDK:** also TypeScript, AWS-native, rich L2 constructs; synthesizes CloudFormation (stack limits, slower
  rollbacks, drift handling). Very similar developer experience.
- **Terraform/OpenTofu:** the most common IaC; HCL instead of TypeScript, so no shared types with the app.
- **SAM / Serverless Framework:** great for function-centric apps, weaker for CloudFront, Cognito, AppSync, OpenSearch.
- **Access keys in GitHub secrets:** long-lived credentials that can leak; OIDC gives 1-hour credentials per job.

## Consequences

- Real code: loops for routes, helpers (`createNodeFunction`), typed config, and unit-testable pieces.
- Locally only `pulumi preview` is allowed; everything else goes through review.
- Environments: today one `dev` stack. A `prod` stack would be a second Pulumi stack with its own config, deployed by a
  job bound to a GitHub **environment** with required reviewers (docs/CICD-SETUP.md).
