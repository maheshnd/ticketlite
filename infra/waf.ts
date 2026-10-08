// AWS WAF on CloudFront (flag enableWaf: a web ACL costs ~$5/month + $1 per rule + per-request fees).
// WAF inspects every request at the edge BEFORE it reaches CloudFront's origins. CONCEPT: waf
import * as aws from "@pulumi/aws";
import { flags, stage } from "./config";

const visibility = (metricName: string) => ({
  cloudwatchMetricsEnabled: true,
  metricName,
  sampledRequestsEnabled: true, // keep samples of blocked requests for debugging
});

// AWS-managed rule groups: maintained by AWS, updated as new attacks appear.
const managed = (priority: number, name: string) => ({
  name,
  priority,
  overrideAction: { none: {} }, // use the group's own actions (block)
  statement: { managedRuleGroupStatement: { vendorName: "AWS", name } },
  visibilityConfig: visibility(name),
});

function createWebAcl() {
  return new aws.wafv2.WebAcl("edge-acl", {
    name: `ticketlite-${stage}`,
    scope: "CLOUDFRONT", // must live in us-east-1, like every CloudFront-scoped resource
    defaultAction: { allow: {} },
    rules: [
      managed(1, "AWSManagedRulesCommonRuleSet"), // OWASP-style: XSS, path traversal, bad bots, ...
      managed(2, "AWSManagedRulesKnownBadInputsRuleSet"), // e.g. Log4Shell payloads
      {
        // At most 1,000 requests per 5 minutes from one IP, then block (protects the API and the bill).
        name: "rate-limit-per-ip",
        priority: 3,
        action: { block: {} },
        statement: { rateBasedStatement: { limit: 1000, aggregateKeyType: "IP" } },
        visibilityConfig: visibility("rate-limit-per-ip"),
      },
    ],
    visibilityConfig: visibility(`ticketlite-${stage}`),
  });
}

export const webAcl = flags.enableWaf ? createWebAcl() : undefined;
