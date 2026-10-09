// OpenSearch (flag enableSearch, default false: a domain costs money every hour, even idle).
// The domain is a separate READ MODEL of the events, kept in sync from the DynamoDB stream by
// search-indexer. CONCEPT: cqrs, eventual-consistency, streams
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { flags, stage } from "./config";
import { eventsTable } from "./dynamodb";
import { streamReadAccess, type PolicyStatement } from "./iam";
import { createNodeFunction } from "./node-function";

const accountId = aws.getCallerIdentityOutput().accountId;

// Step 1: the smallest domain: one t3.small node, 10 GB gp3, OpenSearch 3.7 (the newest AWS offers).
// Encryption at rest + node-to-node + HTTPS only. One node = no replicas and no high availability:
// fine for learning; production uses 3 dedicated masters + data nodes across AZs.
function createDomain() {
  const domain = new aws.opensearch.Domain("search", {
    domainName: `ticketlite-${stage}`,
    engineVersion: "OpenSearch_3.7",
    clusterConfig: { instanceType: "t3.small.search", instanceCount: 1, zoneAwarenessEnabled: false },
    ebsOptions: { ebsEnabled: true, volumeType: "gp3", volumeSize: 10 },
    encryptAtRest: { enabled: true },
    nodeToNodeEncryption: { enabled: true },
    domainEndpointOptions: { enforceHttps: true, tlsSecurityPolicy: "Policy-Min-TLS-1-2-2019-07" },
    // The resource policy delegates to IAM: any principal of THIS account that has an IAM policy allowing
    // es:ESHttp* may call it (requests must be SigV4-signed). Our Lambda roles get exactly that.
    accessPolicies: pulumi.jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: pulumi.interpolate`arn:aws:iam::${accountId}:root` },
          Action: "es:ESHttp*",
          Resource: pulumi.interpolate`arn:aws:es:us-east-1:${accountId}:domain/ticketlite-${stage}/*`,
        },
      ],
    }),
  });
  const httpAccess: PolicyStatement = {
    Action: ["es:ESHttpGet", "es:ESHttpHead", "es:ESHttpPut", "es:ESHttpPost", "es:ESHttpDelete"],
    Resource: [pulumi.interpolate`${domain.arn}/*`],
  };
  return { endpoint: pulumi.interpolate`https://${domain.endpoint}`, httpAccess };
}

// Step 2: the indexer, fed by the Events table's stream. Returns its failure queue (alarmed in observability.ts).
function createIndexer(endpoint: pulumi.Output<string>, httpAccess: PolicyStatement) {
  const failures = new aws.sqs.Queue("search-indexer-failures", {
    messageRetentionSeconds: 14 * 24 * 60 * 60,
    sqsManagedSseEnabled: true,
  });
  const indexer = createNodeFunction("search-indexer", {
    codeDir: "../functions/search-indexer/dist",
    environment: { OPENSEARCH_ENDPOINT: endpoint },
    statements: [
      httpAccess,
      streamReadAccess(eventsTable.streamArn),
      { Action: ["sqs:SendMessage"], Resource: [failures.arn] },
    ],
  });

  // Stream -> Lambda. Poll-based and ORDERED per shard, so a failing record blocks the ones after
  // it; these settings stop one poison record from blocking forever. CONCEPT: poison-message
  new aws.lambda.EventSourceMapping("events-stream-to-indexer", {
    eventSourceArn: eventsTable.streamArn,
    functionName: indexer.fn.name,
    startingPosition: "LATEST",
    batchSize: 10,
    bisectBatchOnFunctionError: true, // split a failing batch in two, again and again, to find the bad record
    maximumRetryAttempts: 3,
    maximumRecordAgeInSeconds: 3600,
    functionResponseTypes: ["ReportBatchItemFailures"],
    destinationConfig: { onFailure: { destinationArn: failures.arn } }, // metadata of records that gave up
  });
  return failures;
}

function createSearch() {
  const { endpoint, httpAccess } = createDomain();
  const failures = createIndexer(endpoint, httpAccess);
  return { endpoint, httpAccess, failures };
}

// Undefined when the flag is off: the API then uses its DynamoDB fallback.
export const search = flags.enableSearch ? createSearch() : undefined;
