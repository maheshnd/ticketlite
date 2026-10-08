import { awsLambdaFastify } from "@fastify/aws-lambda";
import { buildApp } from "./app";

// Step 1: build the app OUTSIDE the handler.
// Code at module level runs once per cold start (during Lambda's "init" phase).
// Warm invocations skip it and reuse this same app, which saves time on every request.
const app = buildApp();

// Step 2: wrap the app. The adapter turns an API Gateway event (payload format 2.0)
// into a fake HTTP request for Fastify, then turns Fastify's reply back into the
// response shape API Gateway expects. No real port is opened.
// Exported as "handler" in dist/index.js, so the Lambda handler setting is "index.handler".
export const handler = awsLambdaFastify(app);
