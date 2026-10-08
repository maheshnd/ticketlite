# 0007 — Encryption at rest with AWS-owned / AWS-managed keys (no customer-managed KMS keys)

- **Status:** accepted
- **Date:** 2026-10-08

## Context

Every data store here encrypts at rest: DynamoDB, S3 (SSE-S3), SQS (SSE-SQS), OpenSearch, Aurora, Secrets Manager.
Each lets you choose the key: an **AWS-owned** key (shared, invisible, free), an **AWS-managed** key (`aws/<service>`
in your account, free, auditable in CloudTrail) or a **customer-managed** KMS key (CMK, $1/month + per request).

## Decision

Use the service defaults (AWS-owned or AWS-managed keys). No customer-managed keys.

## Alternatives: customer-managed KMS keys

- \+ You control the key policy: who may decrypt, separately from who may read the table (two locks).
- \+ Rotation, disabling and deleting the key are in your hands ("crypto-shredding": delete the key = data unreadable).
- \+ Required by some compliance regimes (PCI, HIPAA programmes, some banks), and for cross-account sharing of
  encrypted snapshots.
- − $1 per key per month plus API calls; every reader needs `kms:Decrypt`; a broken key policy can lock you out.

## Consequences

Data is encrypted with zero cost and no key management. If TicketLite ever handled card data or had strict
data-residency rules, the first change would be CMKs for the Bookings table, the Aurora cluster and the secrets.
