// CloudFront building blocks used by cdn.ts: origin access control, the URL rewrite function, the security
// headers policy and the 30-second cache policy for the public events list.
// Split from cdn.ts only to keep each file short. CONCEPT: cdn
import * as fs from "node:fs";
import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { postersBucket } from "./storage";

// AWS managed policies (fixed IDs, the same in every account):
export const CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6"; // honours the origin's Cache-Control, gzip/brotli
export const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"; // never cache (authenticated API calls)
export const ALL_VIEWER_EXCEPT_HOST = "b689b0a8-53d0-40ab-baf2-68738e2966ac"; // forward headers, cookies, query strings

// Step 1: Origin Access Control. CloudFront signs its S3 requests (SigV4), and the bucket policies
// in cdn.ts accept only signed requests from THIS distribution. CONCEPT: origin-access-control
export const oac = new aws.cloudfront.OriginAccessControl("s3-oac", {
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

// Step 2: the URL rewrite function for static-export pages (see cdn-rewrite.js).
export const rewrite = new aws.cloudfront.Function("html-rewrite", {
  runtime: "cloudfront-js-2.0",
  code: fs.readFileSync(path.join(__dirname, "cdn-rewrite.js"), "utf8"),
  publish: true,
});

// Step 3: security headers on every response. CONCEPT: security-headers, xss
// The CSP allows only our own origin, plus AppSync (GraphQL + real-time) and direct poster uploads
// to S3. 'unsafe-inline' scripts: Next.js static export inlines small bootstrap scripts.
const csp = pulumi.interpolate`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.appsync-api.us-east-1.amazonaws.com wss://*.appsync-realtime-api.us-east-1.amazonaws.com https://${postersBucket.bucketRegionalDomainName}; form-action 'self' https://*.amazoncognito.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`;
export const securityHeaders = new aws.cloudfront.ResponseHeadersPolicy("security-headers", {
  securityHeadersConfig: {
    strictTransportSecurity: { accessControlMaxAgeSec: 63072000, includeSubdomains: true, override: true },
    contentTypeOptions: { override: true }, // X-Content-Type-Options: nosniff
    frameOptions: { frameOption: "DENY", override: true }, // no clickjacking via <iframe>
    referrerPolicy: { referrerPolicy: "strict-origin-when-cross-origin", override: true },
    contentSecurityPolicy: { contentSecurityPolicy: csp, override: true },
  },
});

// Step 4: a short cache for the PUBLIC events list. Every visitor sees the same list, so CloudFront can
// answer most requests itself for 30 seconds; the cache key includes the query string (?city=&cursor=),
// never headers or cookies, so it can't mix up users. Authenticated routes stay uncached. CONCEPT: cdn
export const eventsListCache = new aws.cloudfront.CachePolicy("api-events-30s", {
  minTtl: 0,
  defaultTtl: 30,
  maxTtl: 30,
  parametersInCacheKeyAndForwardedToOrigin: {
    queryStringsConfig: { queryStringBehavior: "all" },
    headersConfig: { headerBehavior: "none" },
    cookiesConfig: { cookieBehavior: "none" },
    enableAcceptEncodingGzip: true,
    enableAcceptEncodingBrotli: true,
  },
});
