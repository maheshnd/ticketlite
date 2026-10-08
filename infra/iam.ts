import * as aws from "@pulumi/aws";

// The IAM role the Lambda function "wears" while it runs.
// Step 1: the trust policy says WHO may assume the role. Here only the Lambda service can.
export const lambdaRole = new aws.iam.Role("api-lambda-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  }),
});

// Step 2: the permissions say WHAT the role may do.
// Least privilege: only write logs to CloudWatch (CreateLogStream, PutLogEvents, ...).
// When DynamoDB arrives, we add a narrow policy for that one table and nothing more.
export const basicLogsAttachment = new aws.iam.RolePolicyAttachment("api-lambda-basic-logs", {
  role: lambdaRole.name,
  policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});
