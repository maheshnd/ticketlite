// Entry point. It only wires the service files together and exports outputs.
// Importing a file creates the resources declared in it.
import { httpStage } from "./http-api";
import "./http-routes";
import { cognitoDomainUrl, userPool, userPoolClient } from "./cognito";
import { eventsTable, organizersTable } from "./dynamodb";
import { distribution } from "./cdn";
import { postersBucket, webBucket } from "./storage";

// The public URL of the app. Try: curl "$(pulumi stack output cloudFrontUrl)/api/health"
export const cloudFrontUrl = distribution.domainName.apply((d) => `https://${d}`);
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
