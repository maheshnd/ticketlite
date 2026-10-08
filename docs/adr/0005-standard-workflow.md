# 0005 — Step Functions Standard (not Express) for the booking saga

- **Status:** accepted
- **Date:** 2026-10-08

## Context

Step Functions has two workflow types:

| | Standard | Express |
|---|---|---|
| Max duration | 1 year | 5 minutes |
| Execution semantics | exactly-once per step | at-least-once (async) / at-most-once (sync) |
| History | full, visual, 90 days in the console | CloudWatch Logs only (if enabled) |
| Pricing | per state transition (~$25 / million) | per request + duration (much cheaper at high volume) |
| Typical use | business processes, sagas, human approval | high-volume event processing, IoT, streaming |

## Decision

Use a **Standard** workflow for the booking saga (`type: "STANDARD"` in `infra/stepfunctions.ts`).

## Why

- A booking moves money. Exactly-once step execution and a durable, visual history make support and audits easy
  ("what happened to booking X?").
- Payment retries with backoff can take tens of seconds; future steps (e.g. waiting for a 3-D Secure callback
  with `.waitForTaskToken`) could take minutes. Express's 5-minute cap would be a trap.
- Volume is low (bookings, not page views), so Standard's per-transition price is negligible.

## Consequences

- ~7 state transitions per booking. At 1 million bookings a month that would be ~$175; at that scale an
  Express workflow (with idempotent steps, which we already have) would be worth evaluating.
- Execution names must be unique for 90 days: we use the `bookingId`, which also prevents duplicate sagas.
