// Connects Drizzle to Aurora through the RDS Data API: SQL over HTTPS, authenticated with IAM + the database
// secret. No VPC, no TCP connections, no connection pool to manage in Lambda. CONCEPT: connection-pooling
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import * as schema from "./schema";

export type SqlConfig = { resourceArn: string; secretArn: string; database: string };

export function createDb(config: SqlConfig) {
  return drizzle(new RDSDataClient({}), { ...config, schema });
}
export type Db = ReturnType<typeof createDb>;

// With scale to zero the cluster pauses when idle. The first call then fails with this error while it
// resumes (~15 s). Callers retry later (the stream retries; the API answers 503 + Retry-After).
export const isDatabaseResuming = (error: unknown) =>
  (error as { name?: string }).name === "DatabaseResumingException" ||
  String((error as { message?: string }).message).includes("resuming");
