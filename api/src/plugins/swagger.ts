// OpenAPI docs generated from the routes' Zod schemas, served at /api/docs.
// Only outside production: public API docs make it easier for attackers to map the API.
import { join } from "node:path";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { config } from "../config";
import type { App } from "../types";

export async function registerSwagger(app: App) {
  if (config.stage !== "local" && config.stage !== "dev") return;

  // Step 1: build the OpenAPI document. jsonSchemaTransform converts each route's Zod schemas to JSON Schema.
  await app.register(swagger, {
    openapi: { info: { title: "TicketLite API", version: "1.0.0" } },
    transform: jsonSchemaTransform,
  });

  // Step 2: serve the Swagger UI page. Inside Lambda the code is one esbuild bundle, so the UI's static
  // files are copied next to it by build.mjs (dist/static) and we point the plugin there.
  // LAMBDA_TASK_ROOT is set by Lambda itself ("/var/task"); locally it is undefined and the plugin
  // finds its files in node_modules as usual.
  const taskRoot = process.env.LAMBDA_TASK_ROOT;
  await app.register(swaggerUi, {
    routePrefix: "/api/docs",
    ...(taskRoot ? { baseDir: join(taskRoot, "static") } : {}),
  });
}
