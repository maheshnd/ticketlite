# bootstrap

A separate, one-time Pulumi stack (`ticketlite-bootstrap/dev`) that lets GitHub Actions log in to AWS without keys:

- `oidc.ts`: GitHub's OIDC identity provider in the AWS account.
- `roles.ts`: the **preview** role (ReadOnlyAccess; trusted only for `pull_request` events of `maheshnd/ticketlite`) and
  the **deploy** role (AdministratorAccess, with the reasons and the narrower company alternative in comments; trusted
  only for `refs/heads/main`). Both check `aud = sts.amazonaws.com`.

**The owner runs it once by hand** (docs/CICD-SETUP.md, step 2). It is the only `pulumi up` ever run from a laptop;
Claude never runs it. Outputs `previewRoleArn` and `deployRoleArn` go into GitHub repository variables.
