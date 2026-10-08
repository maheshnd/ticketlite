// Reads environment variables ONCE (at cold start) and hands the rest of the app a typed, validated object.
// If a required variable is missing, the Lambda fails at init with a clear message instead of
// failing later on some random request. CONCEPT: fail-fast
import { z } from "zod";

// Step 1: describe every variable the API reads. Defaults suit local development.
const EnvSchema = z.object({
  // "local" = laptop (src/local.ts); otherwise the Pulumi stack name (e.g. "dev").
  STAGE: z.string().default("local"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // The Next.js dev server. CORS is only turned on locally: in the cloud, CloudFront serves the web
  // app and the API from ONE origin, so the browser never makes a cross-origin call. CONCEPT: same-origin
  LOCAL_WEB_ORIGIN: z.url().default("http://localhost:3001"),
  AWS_REGION: z.string().default("us-east-1"), // set by Lambda itself in the cloud
  // Only set locally: points the SDK at DynamoDB Local (docker-compose) instead of AWS.
  DYNAMODB_ENDPOINT: z.url().optional(),
  // Table names come from Pulumi in the cloud. The defaults match scripts/create-local-tables.ts.
  EVENTS_TABLE: z.string().default("Events"),
  ORGANIZERS_TABLE: z.string().default("Organizers"),
  SESSIONS_TABLE: z.string().default("Sessions"),
  BOOKINGS_TABLE: z.string().default("Bookings"),
  IDEMPOTENCY_TABLE: z.string().default("IdempotencyKeys"),
  // The booking saga and the posters bucket. Empty locally: those features need the deployed stack.
  BOOKING_STATE_MACHINE_ARN: z.string().default(""),
  POSTERS_BUCKET: z.string().default(""),
  // Flags that mirror Pulumi's cost-safety flags. Off = the API uses a simpler fallback, never an error.
  CACHE_ENABLED: z.enum(["true", "false"]).default("false"),
  REDIS_URL: z.string().optional(), // local only (docker-compose). In AWS the URL is a secret:
  REDIS_SECRET_ARN: z.string().optional(), // Secrets Manager, read at runtime (never an env var value)
  OPENSEARCH_ENDPOINT: z.string().optional(), // unset = search falls back to DynamoDB
  EVENT_BUS_NAME: z.string().optional(), // unset (local) = domain events are only logged
  // Optional SQL reporting (flag enableSql): Aurora cluster ARN + its managed secret ARN (not the password).
  SQL_CLUSTER_ARN: z.string().optional(),
  SQL_SECRET_ARN: z.string().optional(),
  SQL_DATABASE: z.string().default("ticketlite"),
  // Cognito IDs (not secrets). Empty locally until you copy them from `pulumi stack output` into api/.env.
  USER_POOL_ID: z.string().default(""),
  USER_POOL_CLIENT_ID: z.string().default(""),
  COGNITO_DOMAIN_URL: z.string().default(""),
  // The public URL of the web app: CloudFront in the cloud, the Next.js dev server locally.
  APP_URL: z.url().default("http://localhost:3001"),
  // Where the browser reaches THIS API. The same as APP_URL in the cloud (CloudFront serves both).
  API_PUBLIC_URL: z.url().default("http://localhost:3000"),
});

// Step 2: parse once. A typo in a variable name or value throws here, at startup.
const env = EnvSchema.parse(process.env);

// Step 3: export plain, well-named values. Nothing else in the app touches process.env.
export const config = {
  stage: env.STAGE,
  isLocal: env.STAGE === "local",
  logLevel: env.LOG_LEVEL,
  localWebOrigin: env.LOCAL_WEB_ORIGIN,
  region: env.AWS_REGION,
  dynamodbEndpoint: env.DYNAMODB_ENDPOINT,
  tables: {
    events: env.EVENTS_TABLE,
    organizers: env.ORGANIZERS_TABLE,
    sessions: env.SESSIONS_TABLE,
    bookings: env.BOOKINGS_TABLE,
    idempotency: env.IDEMPOTENCY_TABLE,
  },
  bookingStateMachineArn: env.BOOKING_STATE_MACHINE_ARN,
  postersBucket: env.POSTERS_BUCKET,
  cache: {
    enabled: env.CACHE_ENABLED === "true",
    redisUrl: env.REDIS_URL,
    redisSecretArn: env.REDIS_SECRET_ARN,
  },
  opensearchEndpoint: env.OPENSEARCH_ENDPOINT,
  eventBusName: env.EVENT_BUS_NAME,
  sql:
    env.SQL_CLUSTER_ARN && env.SQL_SECRET_ARN
      ? { resourceArn: env.SQL_CLUSTER_ARN, secretArn: env.SQL_SECRET_ARN, database: env.SQL_DATABASE }
      : undefined,
  cognito: {
    userPoolId: env.USER_POOL_ID,
    clientId: env.USER_POOL_CLIENT_ID,
    domainUrl: env.COGNITO_DOMAIN_URL,
  },
  appUrl: env.APP_URL,
  apiPublicUrl: env.API_PUBLIC_URL,
};
