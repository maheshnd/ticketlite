// CloudFront: the ONE public entry point. It serves the web app from S3 and forwards /api/* to API
// Gateway, so the browser sees a single origin: first-party cookies, no CORS. CONCEPT: same-origin, cdn
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { httpApi } from "./http-api";
import { postersBucket, webBucket } from "./storage";
import { customDomain } from "./domain";
import { webAcl } from "./waf";
import {
  ALL_VIEWER_EXCEPT_HOST,
  CACHING_DISABLED,
  CACHING_OPTIMIZED,
  eventsListCache,
  oac,
  rewrite,
  securityHeaders,
} from "./cdn-policies";

// Step 1: the distribution (its OAC, rewrite function and policies are in cdn-policies.ts).
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

// Step 2: with a custom domain, point it at CloudFront. Alias records are free and follow CloudFront's IPs (A + AAAA for IPv6).
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

// Step 3: bucket policies: "only this distribution may read". AWS:SourceArn pins it to our distribution,
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
