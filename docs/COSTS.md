# Costs

What TicketLite costs in `us-east-1`, what is free, and what each flag turns on.

> **Prices are approximate** (from memory of AWS's public price lists, late 2026) and change. Check
> https://aws.amazon.com/pricing/ and the AWS Pricing Calculator before relying on them. Tags `project=ticketlite`
> let you see real costs in Cost Explorer.

## Default stack (all flags off): ~$1–2 / month at learning traffic

| Service | How it's billed | Free allowance | Expected here |
|---|---|---|---|
| Lambda (arm64) | per request + GB-second | 1M requests + 400k GB-s / month, always | $0 |
| API Gateway HTTP API | per million requests (~$1) | 1M / month for 12 months | ~$0 |
| API Gateway REST API (partner) | per million requests (~$3.50) | 1M / month for 12 months | ~$0 |
| CloudFront | per GB out + per request | 1 TB + 10M requests / month, always | $0 |
| S3 | per GB-month + requests | 5 GB for 12 months | cents |
| DynamoDB on-demand | per million read/write request units | 25 GB storage always free | cents |
| Cognito (Essentials) | per monthly active user | 10,000 MAU | $0 |
| Step Functions Standard | per state transition (~$25 / million) | 4,000 / month | $0 |
| AppSync | per million queries/mutations + real-time messages/minutes | 250k each for 12 months | ~$0 |
| EventBridge (custom events) | ~$1 per million events | — | ~$0 |
| SQS / SNS | per million requests | 1M each / month | $0 |
| SES | per 1,000 emails (~$0.10) | — | ~$0 |
| **Secrets Manager** | **$0.40 per secret / month** | 30-day trial per secret | **$0.40** (payment key) |
| CloudWatch | alarms (~$0.10 each after 10), dashboards (after 3), log ingestion (~$0.50/GB), X-Ray traces | 10 alarms, 3 dashboards, 5 GB logs, 100k traces | ~$0 (7 alarms, 1 dashboard, 7-day logs) |
| KMS | AWS-owned/managed keys | free | $0 |

## Flags (all `false` by default, in `infra/Pulumi.dev.yaml`)

| Flag | Turns on | Approximate cost | Notes |
|---|---|---|---|
| `enableSearch` | OpenSearch domain (1× t3.small.search + 10 GB gp3) + indexer | **~$27 / month** (billed every hour, even idle) | Destroy when not studying search |
| `enableCache` | Upstash Redis usage + 1 more secret | Upstash free tier; +$0.40 secret | Needs an Upstash account |
| `enableSql` | Aurora Serverless v2 (scale to zero) + sql-reporter | ~$0.12 per ACU-hour **while active**, $0 compute when paused; storage ~$0.10 / GB-month | First request after a pause waits ~15 s |
| `enableWaf` | WAF web ACL with 3 rules | **~$8 / month** + $0.60 per million requests | |
| `enableProvisionedConcurrency` | 1 pre-warmed api Lambda copy | ~$4–5 / month (512 MB, arm64) | Paid even with zero traffic |
| `reservedConcurrency` | Reserves N executions for the api | $0 | Low-quota accounts reject it |
| `enableCustomDomain` | ACM certificate (DNS-validated) + CloudFront alias + Route 53 alias records | Certificate free; Route 53 hosted zone ~$0.50 / month + the domain itself | Needs `customDomain` + `hostedZoneId` config and a zone you control |

## Keeping it cheap

- Log groups keep 7 days; Step Functions logs only errors; X-Ray traces are sampled by default.
- On-demand billing everywhere; nothing provisioned except behind flags.
- **Destroy when you're done:** GitHub → Actions → **destroy** → type `destroy`. Everything (including the buckets and
  their files) is deleted; **deploy** brings it back. Secrets are deleted without a recovery window, so names can be reused.
- Set a budget alert: Billing → Budgets → monthly cost budget (e.g. $10) with an email at 80%.
