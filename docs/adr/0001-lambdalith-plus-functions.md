# 0001 — One Fastify "Lambdalith" for the REST API, small Lambdas for async work

- **Status:** accepted
- **Date:** 2026-10-08

## Context

A serverless REST API can be one Lambda per route ("nano-functions") or one Lambda running a whole web framework
that routes internally ("Lambdalith"). Background work (saga steps, queue and stream consumers) has different
triggers, timeouts and permissions from request handling.

## Decision

- **The REST API is one Lambda** (`api/`): Fastify + `@fastify/aws-lambda`, behind an HTTP API with explicit routes.
  The same app runs locally on port 3000 (`api/src/local.ts`).
- **Everything triggered by something other than an HTTP request is its own small Lambda** (`functions/`): saga steps,
  email worker, indexers, poster processor, AppSync batch resolver.

## Alternatives

**One Lambda per route.**
- \+ Least privilege per route; independent scaling and memory settings; a bad deploy hits one route.
- − Dozens of functions, cold starts per route, shared code duplicated or layered, slow local development.

**Containers (ECS/Fargate) for the API.**
- \+ No cold starts, long-lived connections, any framework.
- − Always-on cost, capacity planning, more infrastructure.

## Consequences

- One deployable for the API: fast local dev, one cold start warms every route, normal framework middleware
  (correlation IDs, error handling, validation, OpenAPI).
- The API role holds the union of every route's permissions (still scoped to exact tables and actions). Splitting a
  hot or sensitive route into its own function later is easy: same app, different entry point.
- Async work stays isolated: each function has its own role, timeout, retry policy and failure destination.
- Monolith vs microservices in interviews: this is a *modular monolith* for the synchronous path plus event-driven
  workers, a common pragmatic middle ground.
