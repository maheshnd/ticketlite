// DynamoDB tables. One table per entity (not single-table design) because it is easier to learn from;
// docs/adr/0002-separate-dynamodb-tables.md compares the two.
// All tables are on-demand (pay per request, $0 when idle) and encrypted at rest with an AWS-owned key.
// CONCEPT: dynamodb-access-patterns
import * as aws from "@pulumi/aws";

// A GSI key schema: partition key (HASH) + optional sort key (RANGE).
const keys = (hash: string, range?: string) => [
  { attributeName: hash, keyType: "HASH" },
  ...(range ? [{ attributeName: range, keyType: "RANGE" }] : []),
];

// Step 1: Events. Access patterns: get by id; published events soonest first; events in a city soonest first.
// The stream feeds the search indexer (flag enableSearch): NEW_AND_OLD_IMAGES so deletes and changes can be indexed.
export const eventsTable = new aws.dynamodb.Table("events", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "eventId",
  attributes: [
    { name: "eventId", type: "S" },
    { name: "city", type: "S" },
    { name: "status", type: "S" },
    { name: "startsAt", type: "S" },
  ],
  globalSecondaryIndexes: [
    // "events in Pune, soonest first"
    { name: "byCity", keySchemas: keys("city", "startsAt"), projectionType: "ALL" },
    // "all published events, soonest first". Every published event shares ONE partition key value, a hot
    // partition at large scale (fine here; at scale you would shard it, e.g. "PUBLISHED#0".."#9").
    { name: "byStatus", keySchemas: keys("status", "startsAt"), projectionType: "ALL" },
  ],
  streamEnabled: true,
  streamViewType: "NEW_AND_OLD_IMAGES",
});

// Step 2: Bookings. Access patterns: get by id; my bookings newest first; bookings of an event.
// The stream (NEW_IMAGE) feeds the optional SQL reporter (flag enableSql).
export const bookingsTable = new aws.dynamodb.Table("bookings", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "bookingId",
  attributes: [
    { name: "bookingId", type: "S" },
    { name: "userId", type: "S" },
    { name: "eventId", type: "S" },
    { name: "createdAt", type: "S" },
  ],
  globalSecondaryIndexes: [
    { name: "byUser", keySchemas: keys("userId", "createdAt"), projectionType: "ALL" },
    { name: "byEvent", keySchemas: keys("eventId", "createdAt"), projectionType: "ALL" },
  ],
  streamEnabled: true,
  streamViewType: "NEW_IMAGE",
});

// Step 3: IdempotencyKeys. One item per (user, Idempotency-Key header). TTL deletes items after 24h for free.
// CONCEPT: ttl, idempotency
export const idempotencyTable = new aws.dynamodb.Table("idempotency-keys", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "key",
  attributes: [{ name: "key", type: "S" }],
  ttl: { attributeName: "expiresAt", enabled: true },
});

// Step 4: Sessions, for the session-vs-JWT demo only. TTL removes expired sessions (lazily, within ~48h,
// so the code still checks expiresAt itself).
export const sessionsTable = new aws.dynamodb.Table("sessions", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "sessionId",
  attributes: [{ name: "sessionId", type: "S" }],
  ttl: { attributeName: "expiresAt", enabled: true },
});

// Step 5: Organizers, a small seeded list (used to show the GraphQL N+1 problem in AppSync).
export const organizersTable = new aws.dynamodb.Table("organizers", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "organizerId",
  attributes: [{ name: "organizerId", type: "S" }],
});

// Read/write permissions for one table AND its indexes ("<arn>/index/*"), for IAM policies.
export const tableResources = (table: aws.dynamodb.Table) => [
  table.arn,
  table.arn.apply((arn) => `${arn}/index/*`),
];

// Only the indexes of one table ("<arn>/index/*"): a Query on a GSI is authorized against this ARN,
// while GetItem/PutItem/UpdateItem are authorized against the table ARN itself.
export const indexArns = (table: aws.dynamodb.Table) => table.arn.apply((arn) => `${arn}/index/*`);
