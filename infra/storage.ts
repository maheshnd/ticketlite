// S3 buckets. Both are private: nobody can read them directly, only CloudFront (via Origin Access Control).
// The bucket policies that let CloudFront in live in cdn.ts, because they need the distribution's ARN.
import * as aws from "@pulumi/aws";

// Blocks every way of making a bucket public (ACLs and bucket policies). New buckets already block
// public access by default; we say it explicitly so the intent is visible and cannot drift. CONCEPT: s3-security
function blockPublicAccess(name: string, bucket: aws.s3.Bucket) {
  new aws.s3.BucketPublicAccessBlock(`${name}-public-access-block`, {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });
}

// Step 1: the web bucket holds the Next.js static export (web/out), uploaded by the deploy workflow.
// forceDestroy: the files are rebuilt on every deploy, so the destroy workflow may delete them.
// Encryption at rest is on by default (SSE-S3, AWS-owned keys). CONCEPT: encryption-at-rest
export const webBucket = new aws.s3.Bucket("web", { forceDestroy: true });
blockPublicAccess("web", webBucket);

// Step 2: the posters bucket holds event posters uploaded by admins (presigned POST).
// forceDestroy is fine for a learning stack; a real one would keep uploads (and enable versioning).
export const postersBucket = new aws.s3.Bucket("posters", { forceDestroy: true });
blockPublicAccess("posters", postersBucket);
