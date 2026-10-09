// Custom domain for CloudFront (flag enableCustomDomain): an ACM certificate validated through DNS in a
// Route 53 hosted zone you own. CloudFront only accepts certificates from us-east-1 (our region). CONCEPT: tls
// Without the flag the site uses its *.cloudfront.net name and CloudFront's default certificate.
import * as aws from "@pulumi/aws";
import { customDomainName, flags, hostedZoneId } from "./config";

function createCertificate() {
  if (!customDomainName || !hostedZoneId)
    throw new Error("enableCustomDomain needs customDomain and hostedZoneId in the stack config");

  // Step 1: request a certificate. ACM proves we own the domain by asking for a DNS record...
  const certificate = new aws.acm.Certificate("cdn-cert", {
    domainName: customDomainName,
    validationMethod: "DNS",
  });

  // Step 2: ...which we create in Route 53...
  const option = certificate.domainValidationOptions.apply((options) => options[0]!);
  const record = new aws.route53.Record("cdn-cert-validation", {
    zoneId: hostedZoneId,
    name: option.resourceRecordName,
    type: option.resourceRecordType,
    records: [option.resourceRecordValue],
    ttl: 300,
    allowOverwrite: true,
  });

  // Step 3: ...and wait until ACM has seen it and issued the certificate (ACM renews it automatically).
  const validation = new aws.acm.CertificateValidation("cdn-cert-validated", {
    certificateArn: certificate.arn,
    validationRecordFqdns: [record.fqdn],
  });

  return { domainName: customDomainName, zoneId: hostedZoneId, certificateArn: validation.certificateArn };
}

export const customDomain = flags.enableCustomDomain ? createCertificate() : undefined;
