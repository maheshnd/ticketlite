# 0008 — Optional SQL reporting: Aurora Serverless v2 + Data API + Drizzle

- **Status:** accepted (behind the `enableSql` flag, off by default)
- **Date:** 2026-10-08

## Context

Admins want "revenue per event" and "bookings per day". In DynamoDB that means scanning bookings or maintaining
pre-computed counters for every report. SQL answers it in one query with a JOIN and GROUP BY.

## Decision

- **Aurora Serverless v2 PostgreSQL 17.11** with **scale to zero** (`minCapacity: 0`, pause after 5 idle minutes):
  no compute cost when unused, ~15 s to wake up.
- **RDS Data API** for every query: SQL over HTTPS with IAM + the RDS-managed secret.
- **DynamoDB stays the source of truth**; `sql-reporter` copies bookings from the Bookings stream (CQRS again).
- **Drizzle ORM** for the schema, migrations (`drizzle-kit generate`, committed) and typed queries.

## SQL vs NoSQL here

| | DynamoDB | PostgreSQL |
|---|---|---|
| Access | Known key-based patterns, single-digit ms at any scale | Ad-hoc queries, JOINs, aggregations |
| Schema | Flexible items, denormalized (eventName copied into bookings) | Normalized tables, foreign keys, constraints |
| Scaling | Partitions automatically; no connections | Vertical (ACUs) + read replicas; connections are a limited resource |
| Transactions | Up to 100 items, ACID within DynamoDB | Full ACID, any rows |
| Role in TicketLite | Bookings, seats, sessions: the write path | Reports: the read path |

## Connecting Lambda to SQL: Data API vs RDS Proxy vs direct

- **Direct TCP connections:** each Lambda copy opens its own connection; 1,000 concurrent copies = 1,000 connections,
  which exhausts a small database. Also needs the Lambda in the VPC (and NAT for other AWS calls).
- **RDS Proxy:** pools and multiplexes connections in front of the DB; Lambdas still in the VPC; billed per vCPU/ACU-hour,
  always on.
- **Data API (chosen):** no connections to manage at all, no VPC, IAM auth; slightly higher per-query latency and some
  limits (response size, no streaming). Ideal for low-volume reporting.

## Consequences

- The first report after a pause returns 503 + `Retry-After: 30` while the cluster resumes.
- Storage is billed even when paused (~$0.10/GB-month); the cluster still needs subnets (the default VPC).
- Migrations must be backward compatible (expand → migrate → contract) because the old Lambda version can run during a
  deploy; see `packages/sql/README.md`.
- To verify on first enable: Data API availability for engine 17.11 in the account (it is documented for Serverless v2
  PostgreSQL; the engine-version API doesn't expose it).
