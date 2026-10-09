// The two IAM roles GitHub Actions may assume through OIDC: a read-only preview role for pull requests and
// a deploy role for the main branch only. The trust policy (who may assume) is the real guardrail.
// CONCEPT: oidc, least-privilege
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { githubOidc } from "./oidc";

// "maheshnd/ticketlite", set in Pulumi.dev.yaml.
const githubRepo = new pulumi.Config().require("githubRepo");

// Builds a trust policy: "a GitHub token may assume this role ONLY IF
//   aud = sts.amazonaws.com  (the token was minted for AWS, not some other service) AND
//   sub = <exact value>      (it comes from this repo, for this event or branch)".
// StringEquals (not StringLike) means no wildcards, so nothing else can match by accident.
function githubTrustPolicy(sub: string) {
  return pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Federated: githubOidc.arn },
        Action: "sts:AssumeRoleWithWebIdentity",
        Condition: {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": sub,
          },
        },
      },
    ],
  });
}

// Preview role: used by pull requests to run `pulumi preview`.
// PR code is not reviewed yet, so this role can only READ. It can't create, change or delete anything.
// (GitHub doesn't give OIDC tokens to pull requests from forks, so only branches in this repo get here.)
export const previewRole = new aws.iam.Role("github-preview-role", {
  assumeRolePolicy: githubTrustPolicy(`repo:${githubRepo}:pull_request`),
});
new aws.iam.RolePolicyAttachment("github-preview-readonly", {
  role: previewRole.name,
  policyArn: aws.iam.ManagedPolicy.ReadOnlyAccess,
});

// Deploy role: used ONLY by workflows running on the main branch (pushes, manual runs, destroy).
// Code only reaches main through a merged PR, so this is the reviewed code.
//
// AdministratorAccess is deliberately broad. In a real company this role would be narrower:
// only the services the stack uses (Lambda, API Gateway, IAM roles under a path prefix, logs...),
// often with a permissions boundary so CI can't create roles more powerful than itself.
// We accept it here because this is a single, personal learning account with no production data,
// and the stack grows every phase. Keeping a tight policy in sync would mostly teach IAM debugging.
// The real guardrail is the trust policy: only main of this one repo can use the role.
export const deployRole = new aws.iam.Role("github-deploy-role", {
  assumeRolePolicy: githubTrustPolicy(`repo:${githubRepo}:ref:refs/heads/main`),
});
new aws.iam.RolePolicyAttachment("github-deploy-admin", {
  role: deployRole.name,
  policyArn: aws.iam.ManagedPolicy.AdministratorAccess,
});
