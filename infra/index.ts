// Entry point. It only wires the service files together and exports outputs.
// Importing a file creates the resources declared in it.
import { httpStage } from "./http-api";
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
