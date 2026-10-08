// Lambda entry point. esbuild bundles this file into dist/index.js; the Lambda handler is "index.handler".
// CONCEPT: cold-start, connection-reuse
import { awsLambdaFastify, type PromiseHandler } from "@fastify/aws-lambda";
import { buildApp } from "./app";

// Step 1: build the app OUTSIDE the handler.
// Code at module level runs once per cold start (during Lambda's "init" phase). Warm invocations
// skip it and reuse the same app (and, later, the same AWS SDK clients and their open connections).
const appPromise = buildApp();

// Step 2: wrap the app. The adapter turns an API Gateway event (payload format 2.0) into a fake HTTP
// request for Fastify, then turns Fastify's reply back into the response shape API Gateway expects.
// No real port is opened. The proxy is created once, on the first invocation, and then reused.
let proxy: PromiseHandler | undefined;

export const handler: PromiseHandler = async (event, context) => {
  proxy ??= awsLambdaFastify(await appPromise);
  return proxy(event, context);
};
