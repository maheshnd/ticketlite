// Poster uploads. The browser uploads straight to S3 with a presigned POST (the API never handles the bytes),
// then S3 triggers poster-processor ASYNCHRONOUSLY. Failed invocations land in an SQS queue.
// CONCEPT: presigned-urls, async-invocation
import * as aws from "@pulumi/aws";
import { appUrl } from "./cdn";
import { localWebOrigin } from "./config";
import { eventsTable } from "./dynamodb";
import { createNodeFunction } from "./node-function";
import { postersBucket } from "./storage";

// Step 1: CORS on the bucket. The browser POSTs the file to S3's own domain (cross-origin), so S3 must
// allow our web origins. Only POST, only from our app.
new aws.s3.BucketCorsConfiguration("posters-cors", {
  bucket: postersBucket.id,
  corsRules: [
    {
      allowedMethods: ["POST"],
      allowedOrigins: [appUrl, localWebOrigin],
      allowedHeaders: ["*"],
      maxAgeSeconds: 3000,
    },
  ],
});

// Step 2: where failed async invocations go after Lambda's own retries. Kept 14 days for inspection/redrive.
export const posterFailuresQueue = new aws.sqs.Queue("poster-failures", {
  messageRetentionSeconds: 14 * 24 * 60 * 60,
  sqsManagedSseEnabled: true, // encryption at rest, free
});

// Step 3: the function.
const posterProcessor = createNodeFunction("poster-processor", {
  codeDir: "../functions/poster-processor/dist",
  environment: { EVENTS_TABLE: eventsTable.name },
  statements: [
    // handler.ts: a Range GET of the first 12 bytes, and DeleteObject for invalid files, under posters/ only.
    {
      Action: ["s3:GetObject", "s3:DeleteObject"],
      Resource: [postersBucket.arn.apply((arn) => `${arn}/posters/*`)],
    },
    // handler.ts: set the event's posterKey (a conditional UpdateItem).
    { Action: ["dynamodb:UpdateItem"], Resource: [eventsTable.arn] },
    { Action: ["sqs:SendMessage"], Resource: [posterFailuresQueue.arn] }, // destinations use the function's role
  ],
});

// Step 4: async invocation settings: 2 retries, give up after 1 hour, then send the event to the queue.
new aws.lambda.FunctionEventInvokeConfig("poster-processor-async", {
  functionName: posterProcessor.fn.name,
  maximumRetryAttempts: 2,
  maximumEventAgeInSeconds: 3600,
  destinationConfig: { onFailure: { destination: posterFailuresQueue.arn } },
});

// Step 5: let S3 (this bucket only) invoke the function, then subscribe it to new objects under posters/.
const s3Invoke = new aws.lambda.Permission("posters-invoke-processor", {
  action: "lambda:InvokeFunction",
  function: posterProcessor.fn.name,
  principal: "s3.amazonaws.com",
  sourceArn: postersBucket.arn,
});
new aws.s3.BucketNotification(
  "posters-notification",
  {
    bucket: postersBucket.id,
    lambdaFunctions: [
      { lambdaFunctionArn: posterProcessor.fn.arn, events: ["s3:ObjectCreated:*"], filterPrefix: "posters/" },
    ],
  },
  { dependsOn: [s3Invoke] }, // S3 tests the permission when the notification is created
);
