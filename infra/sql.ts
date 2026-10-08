// Optional SQL reporting (flag enableSql): Aurora Serverless v2 PostgreSQL + sql-reporter.
// See docs/adr/0008-sql-reporting.md. CONCEPT: sql-vs-nosql, connection-pooling
//   - Scale to zero: minCapacity 0 pauses the cluster after 5 idle minutes (no compute bill; storage still billed).
//   - Data API: SQL over HTTPS with IAM auth. Lambdas need no VPC, so no NAT gateway (~$32/month) either.
import * as aws from "@pulumi/aws";
import { flags, stage } from "./config";
import { bookingsTable } from "./dynamodb";
import { createNodeFunction } from "./node-function";

function createSql() {
  // Step 1: the database still lives in a VPC: the account's default VPC is enough (no inbound rules,
  // because nothing connects over TCP: the Data API runs inside AWS's own network).
  const vpc = aws.ec2.getVpcOutput({ default: true });
  const subnets = aws.ec2.getSubnetsOutput({ filters: [{ name: "vpc-id", values: [vpc.id] }] });
  const subnetGroup = new aws.rds.SubnetGroup("sql-subnets", { subnetIds: subnets.ids });
  const securityGroup = new aws.ec2.SecurityGroup("sql-sg", {
    vpcId: vpc.id,
    description: "Aurora (Data API only, no inbound)",
  });

  // Step 2: the cluster. The master password is created and stored by RDS in Secrets Manager
  // (manageMasterUserPassword): it never appears in code, config or Pulumi state.
  const cluster = new aws.rds.Cluster("sql", {
    clusterIdentifier: `ticketlite-${stage}`,
    engine: "aurora-postgresql",
    engineMode: "provisioned", // Serverless v2 runs as "provisioned" with db.serverless instances
    engineVersion: "17.11",
    databaseName: "ticketlite",
    masterUsername: "ticketlite_admin",
    manageMasterUserPassword: true,
    serverlessv2ScalingConfiguration: { minCapacity: 0, maxCapacity: 1, secondsUntilAutoPause: 300 },
    enableHttpEndpoint: true, // the Data API
    storageEncrypted: true,
    dbSubnetGroupName: subnetGroup.name,
    vpcSecurityGroupIds: [securityGroup.id],
    skipFinalSnapshot: true, // a learning stack: destroy without a snapshot
    deletionProtection: false,
  });
  new aws.rds.ClusterInstance("sql-instance", {
    clusterIdentifier: cluster.id,
    instanceClass: "db.serverless",
    engine: "aurora-postgresql",
    engineVersion: cluster.engineVersion,
  });

  const secretArn = cluster.masterUserSecrets.apply((s) => s[0]!.secretArn);
  const dataApi = (actions: string[]) => [
    { Action: actions.map((a) => `rds-data:${a}`), Resource: [cluster.arn] },
    { Action: ["secretsmanager:GetSecretValue"], Resource: [secretArn] },
  ];
  const env = { SQL_CLUSTER_ARN: cluster.arn, SQL_SECRET_ARN: secretArn, SQL_DATABASE: "ticketlite" };

  // Step 3: the reporter, fed by the Bookings stream (same retry settings as the search indexer).
  const failures = new aws.sqs.Queue("sql-reporter-failures", {
    messageRetentionSeconds: 14 * 24 * 60 * 60,
    sqsManagedSseEnabled: true,
  });
  const reporter = createNodeFunction("sql-reporter", {
    codeDir: "../functions/sql-reporter/dist",
    timeout: 30, // the first call after a pause waits for the cluster to resume
    environment: env,
    statements: [
      ...dataApi([
        "ExecuteStatement",
        "BatchExecuteStatement",
        "BeginTransaction",
        "CommitTransaction",
        "RollbackTransaction",
      ]),
      {
        Action: [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams",
        ],
        Resource: [bookingsTable.streamArn],
      },
      { Action: ["sqs:SendMessage"], Resource: [failures.arn] },
    ],
  });
  new aws.lambda.EventSourceMapping("bookings-stream-to-sql", {
    eventSourceArn: bookingsTable.streamArn,
    functionName: reporter.fn.name,
    startingPosition: "LATEST",
    batchSize: 10,
    bisectBatchOnFunctionError: true,
    maximumRetryAttempts: 5,
    maximumRecordAgeInSeconds: 3600,
    functionResponseTypes: ["ReportBatchItemFailures"],
    destinationConfig: { onFailure: { destinationArn: failures.arn } },
  });

  // The api only reads (reports): ExecuteStatement is enough.
  return { env, apiStatements: dataApi(["ExecuteStatement"]) };
}

export const sql = flags.enableSql ? createSql() : undefined;
