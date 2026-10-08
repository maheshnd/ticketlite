import * as aws from "@pulumi/aws";

// GitHub's OIDC identity provider, registered in our AWS account.
// How it works: every GitHub Actions job can ask GitHub for a short-lived signed token (a JWT)
// that says "I am repo X, branch Y, event Z". AWS STS checks the signature against this provider
// and, if a role's trust policy matches, hands back temporary AWS keys.
// Result: no long-lived AWS access keys are ever stored in GitHub.
export const githubOidc = new aws.iam.OpenIdConnectProvider("github-oidc", {
  url: "https://token.actions.githubusercontent.com",
  // "aud" (audience) claim that aws-actions/configure-aws-credentials asks GitHub to put in the token.
  clientIdLists: ["sts.amazonaws.com"],
  // No thumbprintLists: thumbprints are optional now. For GitHub, AWS verifies the TLS certificate
  // with its own trusted root CAs and ignores any thumbprint we set.
});
