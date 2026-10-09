// IAM roles for Lambda functions. Every function gets its OWN role with only the permissions it needs.
// CONCEPT: least-privilege
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// A statement in an IAM policy, e.g. { Action: ["dynamodb:GetItem"], Resource: [tableArn] }.
export type PolicyStatement = {
  Action: string[];
  Resource: pulumi.Input<string>[];
};

// The four actions a Lambda needs to read a DynamoDB stream (poll-based event source mapping).
// ListStreams has no resource type in IAM (it lists stream ARNs, never data), so it only works with "*";
// scoped to the stream ARN it would silently match nothing.
export const streamReadAccess = (streamArn: pulumi.Input<string>): PolicyStatement[] => [
  {
    Action: ["dynamodb:GetRecords", "dynamodb:GetShardIterator", "dynamodb:DescribeStream"],
    Resource: [streamArn],
  },
  { Action: ["dynamodb:ListStreams"], Resource: ["*"] },
];

// Creates one role for one function.
// Step 1: the trust policy says WHO may wear the role: only the Lambda service.
// Step 2: two AWS managed policies every function needs: write its logs, send X-Ray traces.
// Step 3: an inline policy with exactly the extra actions and resources this function uses.
// Returns the role plus the attachments, so the function can `dependsOn` them (logs are never lost).
export function createLambdaRole(name: string, statements: PolicyStatement[] = []) {
  const role = new aws.iam.Role(`${name}-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
  });

  const logs = new aws.iam.RolePolicyAttachment(`${name}-logs`, {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  });
  const xray = new aws.iam.RolePolicyAttachment(`${name}-xray`, {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSXRayDaemonWriteAccess,
  });

  const attachments: pulumi.Resource[] = [logs, xray];
  if (statements.length > 0) {
    attachments.push(
      new aws.iam.RolePolicy(`${name}-policy`, {
        role: role.name,
        policy: pulumi.jsonStringify({
          Version: "2012-10-17",
          Statement: statements.map((s) => ({ Effect: "Allow", ...s })),
        }),
      }),
    );
  }

  return { role, attachments };
}
