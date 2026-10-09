// CloudFront: the ONE public entry point. It serves the web app from S3 and forwards /api/* to API
// Gateway, so the browser sees a single origin: first-party cookies, no CORS. CONCEPT: same-origin, cdn
import * as fs from "node:fs";
import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { httpApi } from "./http-api";
import { postersBucket, webBucket } from "./storage";
import { customDomain } from "./domain";
import { webAcl } from "./waf";

// AWS managed policies (fixed IDs, the same in every account):
const CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6"; // honours the origin's Cache-Control, gzip/brotli
const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"; // never cache (authenticated API calls)
const ALL_VIEWER_EXCEPT_HOST = "b689b0a8-53d0-40ab-baf2-68738e2966ac"; // forward headers, cookies, query strings

// Step 1: Origin Access Control. CloudFront signs its S3 requests (SigV4), and the bucket policies
// below accept only signed requests from THIS distribution. CONCEPT: origin-access-control
const oac = new aws.cloudfront.OriginAccessControl("s3-oac", {
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

// Step 2: the URL rewrite function for static-export pages (see cdn-rewrite.js).
const rewrite = new aws.cloudfront.Function("html-rewrite", {
  runtime: "cloudfront-js-2.0",
  code: fs.readFileSync(path.join(__dirname, "cdn-rewrite.js"), "utf8"),
  publish: true,
});

// Step 3: security headers on every response. CONCEPT: security-headers, xss
// The CSP allows only our own origin, plus AppSync (GraphQL + real-time) and direct poster uploads
// to S3. 'unsafe-inline' scripts: Next.js static export inlines small bootstrap scripts.
const csp = pulumi.interpolate`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.appsync-api.us-east-1.amazonaws.com wss://*.appsync-realtime-api.us-east-1.amazonaws.com https://${postersBucket.bucketRegionalDomainName}; form-action 'self' https://*.amazoncognito.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`;
const securityHeaders = new aws.cloudfront.ResponseHeadersPolicy("security-headers", {
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
const eventsListCache = new aws.cloudfront.CachePolicy("api-events-30s", {
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

// Step 5: the distribution.
export const distribution = new aws.cloudfront.Distribution("cdn", {
  enabled: true,
  isIpv6Enabled: true,
  httpVersion: "http2and3",
  priceClass: "PriceClass_100", // edge locations in North America + Europe only: the cheapest tier
  webAclId: webAcl?.arn, // WAF (flag enableWaf). For WAFv2 this is the web ACL's ARN
  defaultRootObject: "index.html",
  origins: [
    { originId: "web", domainName: webBucket.bucketRegionalDomainName, originAccessControlId: oac.id },
    {
      originId: "posters",
      domainName: postersBucket.bucketRegionalDomainName,
      originAccessControlId: oac.id,
    },
    {
      originId: "api",
      domainName: httpApi.apiEndpoint.apply((url) => url.replace("https://", "")),
      customOriginConfig: {
        httpPort: 80,
        httpsPort: 443,
        originProtocolPolicy: "https-only",
        originSslProtocols: ["TLSv1.2"],
      },
    },
  ],
  // Default: the web app from S3. HTML is uploaded with a short Cache-Control and assets with a long,
  // immutable one (see deploy.yml); CACHING_OPTIMIZED honours whatever the file says.
  defaultCacheBehavior: {
    targetOriginId: "web",
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD"],
    compress: true,
    cachePolicyId: CACHING_OPTIMIZED,
    responseHeadersPolicyId: securityHeaders.id,
    functionAssociations: [{ eventType: "viewer-request", functionArn: rewrite.arn }],
  },
  orderedCacheBehaviors: [
    // Behaviors are matched in order: this exact path first, then the /api/* catch-all.
    {
      pathPattern: "/api/events",
      targetOriginId: "api",
      viewerProtocolPolicy: "https-only",
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD"],
      compress: true,
      cachePolicyId: eventsListCache.id,
      originRequestPolicyId: ALL_VIEWER_EXCEPT_HOST,
      responseHeadersPolicyId: securityHeaders.id,
    },
    // /api/* goes to API Gateway with every header and cookie (the JWT and the refresh cookie), uncached.
    {
      pathPattern: "/api/*",
      targetOriginId: "api",
      viewerProtocolPolicy: "https-only",
      allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      cachedMethods: ["GET", "HEAD"],
      compress: true,
      cachePolicyId: CACHING_DISABLED,
      originRequestPolicyId: ALL_VIEWER_EXCEPT_HOST, // the Host must be API Gateway's own, or it rejects the call
      responseHeadersPolicyId: securityHeaders.id,
    },
    // Posters straight from the posters bucket ("/posters/<eventId>/<file>"), cached at the edge.
    {
      pathPattern: "/posters/*",
      targetOriginId: "posters",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      compress: true,
      cachePolicyId: CACHING_OPTIMIZED,
      responseHeadersPolicyId: securityHeaders.id,
    },
  ],
  // No customErrorResponses on purpose: they apply to the WHOLE distribution, so a 404 or 403 from the
  // API (a missing event, a non-admin user) would be swapped for the web app's 404 page. Missing web
  // pages get S3's plain 404 instead (s3:ListBucket below makes S3 say 404, not 403).
  restrictions: { geoRestriction: { restrictionType: "none" } },
  // Default: CloudFront's own certificate for *.cloudfront.net. With enableCustomDomain: our ACM certificate,
  // SNI only (free; dedicated IPs cost $600/month) and TLS 1.2+.
  aliases: customDomain ? [customDomain.domainName] : undefined,
  viewerCertificate: customDomain
    ? {
        acmCertificateArn: customDomain.certificateArn,
        sslSupportMethod: "sni-only",
        minimumProtocolVersion: "TLSv1.2_2021",
      }
    : { cloudfrontDefaultCertificate: true },
});

// With a custom domain: point it at CloudFront. Alias records are free and follow CloudFront's IPs (A + AAAA for IPv6).
if (customDomain) {
  for (const type of ["A", "AAAA"]) {
    new aws.route53.Record(`cdn-alias-${type}`, {
      zoneId: customDomain.zoneId,
      name: customDomain.domainName,
      type,
      aliases: [
        { name: distribution.domainName, zoneId: distribution.hostedZoneId, evaluateTargetHealth: false },
      ],
    });
  }
}

// Step 6: bucket policies: "only this distribution may read". AWS:SourceArn pins it to our distribution,
// so another CloudFront distribution (even in our account) can't read the buckets.
function allowCloudFront(name: string, bucket: aws.s3.Bucket) {
  new aws.s3.BucketPolicy(`${name}-cloudfront-read`, {
    bucket: bucket.id,
    policy: pulumi.jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "cloudfront.amazonaws.com" },
          Action: ["s3:GetObject", "s3:ListBucket"],
          Resource: [bucket.arn, pulumi.interpolate`${bucket.arn}/*`],
          Condition: { StringEquals: { "AWS:SourceArn": distribution.arn } },
        },
      ],
    }),
  });
}
allowCloudFront("web", webBucket);
allowCloudFront("posters", postersBucket);

// The public URL of the app. The web app AND the API are served from it.
export const appUrl = customDomain
  ? pulumi.output(`https://${customDomain.domainName}`)
  : pulumi.interpolate`https://${distribution.domainName}`;
