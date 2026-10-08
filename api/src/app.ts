// Builds the Fastify app but does NOT start a server.
// Two entry points share it: local.ts listens on a port, and lambda.ts hands it to Lambda.
// Layers: routes/ handle HTTP -> services/ hold the logic -> repositories/ talk to DynamoDB.
import cookie from "@fastify/cookie";
import Fastify, { LogController } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { config } from "./config";
import { genCorrelationId, registerCorrelationId } from "./plugins/correlation-id";
import { registerErrorHandler } from "./plugins/error-handler";
import { registerLocalCors } from "./plugins/cors";
import { registerSwagger } from "./plugins/swagger";
import { healthRoutes } from "./routes/health";
import { eventsRoutes } from "./routes/events";
import { copyInfoRoutes } from "./routes/copy-info";
import { authRoutes } from "./routes/auth";
import { oauthRoutes } from "./routes/oauth";
import { meRoutes } from "./routes/me";
import { demoSessionRoutes } from "./routes/demo-session";
import { bookingRoutes } from "./routes/bookings";
import { adminEventRoutes } from "./routes/admin-events";
import { adminUploadRoutes } from "./routes/admin-uploads";
import { searchRoutes } from "./routes/search";
import { partnerRoutes } from "./routes/partner";
import { adminReportRoutes } from "./routes/admin-reports";

export async function buildApp() {
  // Step 1: the Fastify instance. Logs are JSON lines (CloudWatch Logs Insights can query any field),
  // and every line carries "correlationId" instead of Fastify's default "reqId".
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Never write tokens or cookies into logs. CONCEPT: structured-logging
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    genReqId: genCorrelationId,
    logController: new LogController({ requestIdLogLabel: "correlationId" }),
  }).withTypeProvider<ZodTypeProvider>();

  // Step 2: validate requests and serialize responses with Zod schemas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Step 3: cross-cutting plugins, registered before the routes so they apply to all of them.
  registerCorrelationId(app);
  registerErrorHandler(app);
  await app.register(cookie); // parses the Cookie header into request.cookies; adds reply.setCookie
  await registerLocalCors(app);
  await registerSwagger(app);

  // Step 4: every REST route lives under /api. CloudFront sends /api/* to API Gateway, everything else to S3.
  await app.register(
    async (api) => {
      healthRoutes(api);
      copyInfoRoutes(api);
      eventsRoutes(api);
      authRoutes(api);
      oauthRoutes(api);
      meRoutes(api);
      demoSessionRoutes(api);
      bookingRoutes(api);
      adminEventRoutes(api);
      adminUploadRoutes(api);
      searchRoutes(api);
      adminReportRoutes(api);
    },
    { prefix: "/api" },
  );

  // Step 5: the partner API lives outside /api: partners call the REST API (API key + usage plan) directly.
  await app.register(async (partner) => partnerRoutes(partner), { prefix: "/partner" });

  return app;
}
