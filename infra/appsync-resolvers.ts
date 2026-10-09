// AppSync data sources and resolvers for the GraphQL API defined in appsync.ts.
// JS resolvers read DynamoDB directly, a pipeline guards admin writes, a NONE source triggers subscriptions,
// and a BatchInvoke Lambda resolves Event.organizer. CONCEPT: appsync-resolvers, pipeline-resolvers, n-plus-one
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { code, graphqlApi, runtime } from "./appsync";
import { bookingsTable, eventsTable, organizersTable, tableResources } from "./dynamodb";
import { createNodeFunction } from "./node-function";

// Step 1: data sources. AppSync assumes a role to reach DynamoDB: only these tables, only these actions.
const dsRole = new aws.iam.Role("appsync-ds-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "appsync.amazonaws.com" }),
});
const organizerBatch = createNodeFunction("appsync-organizer-batch", {
  codeDir: "../functions/appsync-organizer-batch/dist",
  environment: { ORGANIZERS_TABLE: organizersTable.name },
  // handler.ts: ONE BatchGetItem for all the organizer ids of a batch.
  statements: [{ Action: ["dynamodb:BatchGetItem"], Resource: [organizersTable.arn] }],
});
new aws.iam.RolePolicy("appsync-ds-policy", {
  role: dsRole.name,
  policy: pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"],
        Resource: [...tableResources(eventsTable)],
      },
      { Effect: "Allow", Action: ["dynamodb:Query"], Resource: [...tableResources(bookingsTable)] },
      { Effect: "Allow", Action: ["lambda:InvokeFunction"], Resource: [organizerBatch.fn.arn] },
    ],
  }),
});

// Data source names: letters, digits and underscores only.
const eventsSource = new aws.appsync.DataSource("events-ds", {
  apiId: graphqlApi.id,
  name: "EventsTable",
  type: "AMAZON_DYNAMODB",
  serviceRoleArn: dsRole.arn,
  dynamodbConfig: { tableName: eventsTable.name },
});
const bookingsSource = new aws.appsync.DataSource("bookings-ds", {
  apiId: graphqlApi.id,
  name: "BookingsTable",
  type: "AMAZON_DYNAMODB",
  serviceRoleArn: dsRole.arn,
  dynamodbConfig: { tableName: bookingsTable.name },
});
// NONE: no backend at all. Used for publishSeatUpdate (just triggers subscriptions) and the admin check.
const noneSource = new aws.appsync.DataSource("none-ds", {
  apiId: graphqlApi.id,
  name: "None",
  type: "NONE",
});
const organizerSource = new aws.appsync.DataSource("organizer-ds", {
  apiId: graphqlApi.id,
  name: "OrganizerBatchLambda",
  type: "AWS_LAMBDA",
  serviceRoleArn: dsRole.arn,
  lambdaConfig: { functionArn: organizerBatch.fn.arn },
});

// Step 2: unit resolvers: one field -> one data source -> one JS file.
const unit = (
  field: string,
  type: string,
  source: aws.appsync.DataSource,
  file: string,
  maxBatchSize?: number,
) =>
  new aws.appsync.Resolver(`${type}-${field}`, {
    apiId: graphqlApi.id,
    type,
    field,
    kind: "UNIT",
    dataSource: source.name,
    runtime,
    code: code(file),
    maxBatchSize,
  });
unit("events", "Query", eventsSource, "query-events");
unit("event", "Query", eventsSource, "query-event");
unit("myBookings", "Query", bookingsSource, "query-my-bookings");
unit("publishSeatUpdate", "Mutation", noneSource, "mutation-publish-seat-update");
// BatchInvoke: up to 20 Event.organizer lookups per Lambda call. Set 0 to watch the N+1 problem come back.
unit("organizer", "Event", organizerSource, "field-event-organizer", 20);

// Step 3: pipeline resolvers: check-admin (NONE) runs first, then the DynamoDB write.
const fn = (name: string, source: aws.appsync.DataSource, file: string) =>
  new aws.appsync.Function(name, {
    apiId: graphqlApi.id,
    name: name.replace(/-/g, "_"),
    dataSource: source.name,
    runtime,
    code: code(file),
  });
const checkAdmin = fn("check-admin", noneSource, "fn-check-admin");
const createEventFn = fn("create-event", eventsSource, "fn-create-event");
const updateEventFn = fn("update-event", eventsSource, "fn-update-event");

// One pipeline per admin mutation: [check-admin, write]. The outer code (pipeline.js) just returns the result.
const pipeline = (field: string, write: aws.appsync.Function) =>
  new aws.appsync.Resolver(`Mutation-${field}`, {
    apiId: graphqlApi.id,
    type: "Mutation",
    field,
    kind: "PIPELINE",
    runtime,
    code: code("pipeline"),
    pipelineConfig: { functions: [checkAdmin.functionId, write.functionId] },
  });
pipeline("createEvent", createEventFn);
pipeline("updateEvent", updateEventFn);
