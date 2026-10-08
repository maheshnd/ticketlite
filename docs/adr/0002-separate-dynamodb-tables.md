# 0002 — Separate DynamoDB tables instead of single-table design

- **Status:** accepted
- **Date:** 2026-10-08

## Context

DynamoDB has no joins. A common pattern for production DynamoDB apps is **single-table design**: every
entity (events, bookings, users, …) lives in ONE table, with generic keys like `PK = EVENT#123`,
`SK = BOOKING#456`, so related items can be read together in one `Query`.

TicketLite is a learning project: the owner reads every file and must be able to explain the data model in
an interview.

## Decision

Use **one table per entity**: `Events`, `Bookings`, `IdempotencyKeys`, `Sessions`, `Organizers`
(`infra/dynamodb.ts`). Each table has natural key names (`eventId`, `bookingId`) and only the GSIs its access
patterns need. Each repository file lists its access patterns at the top.

## Alternatives

**Single-table design.**
- \+ Fetch an item and its related items in one request (e.g. an event and its latest bookings: `PK = EVENT#1`).
- \+ Fewer tables to provision, monitor, back up and grant IAM access to.
- \+ Transactions and streams cover every entity in one place.
- − Harder to read: generic `PK`/`SK`/`GSI1PK` attributes, overloaded indexes, key prefixes everywhere.
- − Access patterns must be known up front; a new one often means a migration (backfilling a new GSI key).
- − Analytics and ad-hoc exports are harder (every row has a different shape).

## Consequences

- The code is easy to follow, and each table's IAM policy can be tight.
- "Event + its bookings" needs two requests (one per table). At our scale that costs nothing extra.
- `TransactWriteItems` still works across tables (M3 reserves a seat and updates a booking atomically).

**When would a team choose single-table?** When a few hot, well-known access patterns must be served with
the lowest latency and cost at very large scale (e.g. an order with its line items, read millions of times a
day), and the team has the DynamoDB experience to maintain it. Many teams start with separate tables and
merge only the entities that are always read together.
