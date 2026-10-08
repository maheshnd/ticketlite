// Builds the Fastify app but does NOT start a server.
// Two entry points share it: local.ts listens on a port, and lambda.ts hands it to Lambda.
// Layers: routes/ handle HTTP -> services/ hold the logic -> repositories/ talk to DynamoDB.
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
  await registerLocalCors(app);
  await registerSwagger(app);

  // Step 4: every REST route lives under /api. CloudFront sends /api/* to API Gateway, everything else to S3.
  await app.register(
    async (api) => {
      healthRoutes(api);
      copyInfoRoutes(api);
      eventsRoutes(api);
    },
    { prefix: "/api" },
  );

  return app;
}
