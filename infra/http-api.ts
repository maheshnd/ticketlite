// The public HTTP API (API Gateway v2) itself. Its routes, Lambda integration, JWT authorizer and stage live
// in http-routes.ts. They are split only to avoid an import cycle: CloudFront needs this API's URL, Cognito
// needs CloudFront's URL, and the routes need Cognito (authorizer) and the Lambda (which needs Cognito's IDs).
// (The partner API in partner-api.ts is a REST API, because only REST APIs have API keys + usage plans.)
import * as aws from "@pulumi/aws";
import { localWebOrigin } from "./config";

// CORS allows ONLY the local Next.js dev server. In the cloud the browser calls /api/* on the CloudFront
// domain (same origin), so production traffic never needs CORS. CONCEPT: cors
export const httpApi = new aws.apigatewayv2.Api("http-api", {
  protocolType: "HTTP",
  corsConfiguration: {
    allowOrigins: [localWebOrigin],
    allowCredentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: [
      "content-type",
      "authorization",
      "idempotency-key",
      "x-csrf",
      "x-correlation-id",
      "if-none-match",
    ],
    exposeHeaders: ["x-correlation-id", "etag", "retry-after", "location"],
    maxAge: 600,
  },
});
