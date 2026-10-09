// Reads the stack config (Pulumi.<stack>.yaml) once and exports typed values.
// Every other infra file imports from here instead of calling `new pulumi.Config()` itself.
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();

// Step 1: the stack name ("dev") doubles as the stage name in resource names and env vars.
export const stage = pulumi.getStack();

// Step 2: cost-safety flags. Paid or always-on services are created only when their flag is true.
// CONCEPT: cost-safety
export const flags = {
  enableSearch: cfg.getBoolean("enableSearch") ?? false,
  enableCache: cfg.getBoolean("enableCache") ?? false,
  enableSql: cfg.getBoolean("enableSql") ?? false,
  enableWaf: cfg.getBoolean("enableWaf") ?? false,
  enableCustomDomain: cfg.getBoolean("enableCustomDomain") ?? false,
  enableProvisionedConcurrency: cfg.getBoolean("enableProvisionedConcurrency") ?? false,
  // A number, not a flag. Unset by default: accounts with a low concurrency quota reject any
  // reservation, because AWS keeps at least 100 "unreserved" executions for everything else.
  reservedConcurrency: cfg.getNumber("reservedConcurrency"),
};

// Step 3: plain settings.
export const alertEmail = cfg.require("alertEmail");
export const sesEmail = cfg.require("sesEmail");
export const localWebOrigin = cfg.require("localWebOrigin");
// Only with enableCustomDomain: the site's domain (e.g. tickets.example.com) and its Route 53 hosted zone.
export const customDomainName = cfg.get("customDomain");
export const hostedZoneId = cfg.get("hostedZoneId");
// 0..1: how often the fake payment provider is "unavailable" (a transient error the saga retries).
export const paymentFailureRate = cfg.getNumber("paymentFailureRate") ?? 0;
