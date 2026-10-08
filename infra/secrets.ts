// Secrets Manager secrets. Pulumi creates the CONTAINERS only; the VALUES are set by hand, once, so they
// never appear in code, in Pulumi state or in env vars (docs/CICD-SETUP.md):
//   aws secretsmanager put-secret-value --secret-id <arn> --secret-string '<value>'
// Lambdas read them at runtime with Powertools Parameters (cached 5 minutes). CONCEPT: secrets-management
// Cost: $0.40 per secret per month.
import * as aws from "@pulumi/aws";
import { flags, stage } from "./config";

// Always on: the fake payment provider's signing key (booking-process-payment signs with it).
export const paymentSecret = new aws.secretsmanager.Secret("payment-signing-secret", {
  name: `ticketlite/${stage}/payment-signing-secret`,
  description: "HMAC key for the fake payment provider. Set the value by hand.",
  recoveryWindowInDays: 0, // delete at once on destroy, so the name can be reused by the next deploy
});

// Only with enableCache: the Upstash Redis URL (it contains the password), e.g. rediss://default:<pw>@<host>:6379
export const redisSecret = flags.enableCache
  ? new aws.secretsmanager.Secret("upstash-redis-url", {
      name: `ticketlite/${stage}/upstash-redis-url`,
      description: "Upstash Redis connection URL (rediss://...). Set the value by hand.",
      recoveryWindowInDays: 0,
    })
  : undefined;
