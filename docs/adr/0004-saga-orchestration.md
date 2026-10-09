# 0004 — Booking saga: orchestration with Step Functions (not choreography)

- **Status:** accepted
- **Date:** 2026-10-08

## Context

A booking takes seats (DynamoDB), charges a card (an external provider) and confirms. No single database
transaction can cover all three, so we use a **saga**: a sequence of local steps where each failure triggers
compensating steps that undo earlier ones (`ReleaseSeat` undoes `ReserveSeat`).

A saga can be coordinated two ways:
- **Orchestration:** one coordinator (here a Step Functions state machine) calls each step and decides what
  happens next, including retries and compensation.
- **Choreography:** no coordinator. Each service reacts to events (e.g. `SeatReserved` → payment service listens
  → `PaymentFailed` → seat service listens and releases).

## Decision

**Orchestrate** the booking saga with a Step Functions Standard state machine
(`infra/booking-state-machine.asl.json`). Use **choreography** (EventBridge) only for side effects that nobody
waits on: confirmation emails, admin notifications, search indexing.

## Alternatives

**Choreography with EventBridge/SQS.**
- \+ Services are loosely coupled; adding a new listener changes nothing else.
- − The flow exists only in people's heads: no single place shows "where is booking X stuck?".
- − Compensation logic is spread over several services; cycles and lost events are easy to create.
- − Retries, timeouts and backoff must be built (and tested) in every service.

**Plain code in one Lambda** (reserve, pay, confirm in sequence).
- \+ Simplest to write.
- − A crash or timeout halfway leaves a half-done booking and no record of where it stopped.
- − Lambda's 15-minute limit; payment retries with backoff burn paid Lambda time while waiting.

## Consequences

- Every booking has a visual execution history (90 days) showing each step's input, output, retries and errors.
- Retries, backoff with jitter and catch/compensation are declared in the state machine, not hand-coded.
- Each step must be **idempotent** (Step Functions may run a task again); we use conditional writes.
- Cost: Standard workflows bill per state transition (~$25 per million; 4,000 free per month), fine at our volume.
- The orchestrator is a central dependency; its definition must be versioned and reviewed like code (it is).
