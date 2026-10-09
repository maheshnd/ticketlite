// Entry point. It only wires the service files together and exports outputs.
// Importing a file creates the resources declared in it.
import { httpStage } from "./http-routes";
import "./uploads";
import { emailDlq, eventBus } from "./events";
import { paymentSecret, redisSecret } from "./secrets";
import "./observability";
import { partnerApiUrl as partnerUrl, partnerKey } from "./partner-api";
import { cognitoDomainUrl, userPool, userPoolClient } from "./cognito";
import { apiKey, graphqlUrl } from "./appsync";
import "./appsync-resolvers";
import * as pulumi from "@pulumi/pulumi";
import { bookingsTable, eventsTable, idempotencyTable, organizersTable, sessionsTable } from "./dynamodb";
import { search } from "./search";
import { bookingStateMachine } from "./stepfunctions";
import { appUrl, distribution } from "./cdn";
import { postersBucket, webBucket } from "./storage";

// The public URL of the app. Try: curl "$(pulumi stack output cloudFrontUrl)/api/health"
export const cloudFrontUrl = appUrl; // the custom domain when enableCustomDomain is on
export const distributionId = distribution.id;

// API Gateway's own URL (CloudFront forwards /api/* here). Handy for debugging without the CDN.
export const apiUrl = httpStage.invokeUrl;

// The deploy workflow uploads web/out to webBucketName.
export const webBucketName = webBucket.bucket;
export const postersBucketName = postersBucket.bucket;

// Cognito IDs, for the seed script and for adding an admin by hand.
export const userPoolId = userPool.id;
export const userPoolClientId = userPoolClient.id;
export const cognitoDomain = cognitoDomainUrl;

// Table names, read by the seed workflow (seed.yml).
export const eventsTableName = eventsTable.name;
export const organizersTableName = organizersTable.name;
export const sessionsTableName = sessionsTable.name;
export const bookingsTableName = bookingsTable.name;
export const idempotencyTableName = idempotencyTable.name;

// For local development against the deployed stack (`pnpm dev:env` writes these into api/.env.local).
export const bookingStateMachineArn = bookingStateMachine.arn;
export const opensearchEndpoint = search?.endpoint ?? ""; // empty when enableSearch is off

// AppSync, baked into the web app at build time (deploy.yml). The API key is public by design (it ships in
// the browser's JavaScript), so it is deliberately exported as a plain value, not a Pulumi secret.
export const appsyncUrl = graphqlUrl;
export const appsyncApiKey = pulumi.unsecret(apiKey.key);

// Event-driven pieces (for the runbook: inspect / redrive the DLQ).
export const eventBusName = eventBus.name;
export const emailDlqUrl = emailDlq.url;

// Secret ARNs: set their values by hand once (docs/CICD-SETUP.md). Never the values themselves.
export const paymentSecretArn = paymentSecret.arn;
export const redisSecretArn = redisSecret?.arn ?? ""; // empty when enableCache is off

// Partner REST API. The key IS a credential (it identifies and meters a partner), so it stays a secret:
//   pulumi stack output partnerApiKey --show-secrets
export const partnerApiUrl = partnerUrl;
export const partnerApiKey = pulumi.secret(partnerKey.value);
