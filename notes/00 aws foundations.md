# Phase 0 — AWS Foundations

> TicketLite running example: **a user clicks "Book seat"**.
> Every section below explains one piece of what makes that click work safely on AWS.

## Table of contents

1. [What serverless means](#1-what-serverless-means)
2. [Regions and Availability Zones](#2-regions-and-availability-zones)
3. [IAM — who can do what](#3-iam--who-can-do-what)
4. [Securing the AWS account](#4-securing-the-aws-account)
5. [Credentials and profiles](#5-credentials-and-profiles)
6. [Pulumi — infrastructure as code](#6-pulumi--infrastructure-as-code)
7. [Interview answer scripts](#7-interview-answer-scripts)
8. [Recall card](#8-recall-card)

---

## 1. What serverless means

**Easy meaning:** servers still exist, but AWS manages them. You give code; AWS runs it only when needed.

```
Server way (EC2)                 Serverless way (Lambda)
-----------------                -----------------------
runs 24/7                        runs only on a request
you patch the OS                 AWS patches everything
you add servers for traffic      AWS adds copies automatically
pay every hour                   pay per request, $0 when idle
```

**In TicketLite:** "Book seat" → API Gateway → Lambda runs ~200 ms → writes to DynamoDB → Lambda goes quiet.

**Serverless is more than Lambda:**

| Need | Service |
|---|---|
| Run code | Lambda |
| HTTP requests | API Gateway |
| GraphQL | AppSync |
| Data | DynamoDB |
| Files | S3 |
| Queue | SQS |
| Login | Cognito |

**Test:** *Do I choose a server size or count?* No → serverless.

### Trade-offs

- **Cold start** — first request after idle is slower (AWS prepares a fresh copy).
- **15-minute max** run time per Lambda.
- **Stateless** — each request may hit a different copy, so no data in variables. Use DynamoDB/Redis.
- **Vendor lock-in** — tied to AWS services.
- **Constant heavy load** — a normal server can be cheaper.
- **Harder debugging** — many small parts, needs good logs and tracing.

---

## 2. Regions and Availability Zones

**Easy meaning:**

- **Region** = a geographic area (our app: `us-east-1`, N. Virginia). Fully separate from other regions.
- **Availability Zone (AZ)** = one or more data centres inside a region, with own power and network, a few km apart. Usually 3+ per region.
- **Edge location** = small CDN sites in many cities, used by CloudFront.

```
Region us-east-1
 ├── AZ a → Lambda copies, DynamoDB copy
 ├── AZ b → Lambda copies, DynamoDB copy
 └── AZ c → Lambda copies, DynamoDB copy

Global (not per region): IAM, CloudFront, Route 53
```

### High availability (HA)

**Easy meaning:** the app keeps working when something breaks.

- One EC2 server in one AZ → that AZ fails → app is down.
  Fix = 2+ servers in different AZs + load balancer + Auto Scaling + multi-AZ database (all manual).
- Lambda, DynamoDB, S3, SQS, API Gateway, AppSync, Cognito → **multi-AZ by default**.
  AZ b goes down → TicketLite keeps working.

### Disaster recovery (DR)

Surviving a **whole region** outage. Needs DynamoDB Global Tables + Route 53 failover. Costly — only when downtime is very expensive (e.g. payments).

### Region notes

- CloudFront HTTPS certificates (ACM) **must be in `us-east-1`** — we're already there.
- `us-east-1` is the oldest, busiest region; several big AWS outages started there.

---

## 3. IAM — who can do what

**Easy meaning:** IAM is the security guard. Every AWS action is checked: **WHO can do WHAT on WHICH resource.**

### WHO — identities

| Identity | Meaning | In TicketLite |
|---|---|---|
| Root user | Signup email, can do everything | Locked away, never used daily |
| IAM user | A person with password / access key | `mahesh-dev` |
| Group | Bundle of users with same permissions | `admins` |
| Role | Borrowed identity, temporary keys | Every Lambda gets one |

### WHAT + WHICH — a policy

Booking Lambda's policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:PutItem", "dynamodb:UpdateItem"],
    "Resource": "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/Bookings"
  }]
}
```

- `Effect` → Allow or Deny
- `Action` → exact operations
- `Resource` → exact thing, by its **ARN** (full unique address)

### How IAM decides

1. Everything **denied by default**
2. Explicit **Allow** opens it
3. Explicit **Deny always wins**

### Least privilege

Give only what is needed. Email Lambda hacked → can send email, **cannot** delete bookings. This limits the **blast radius**.

### Policy types

- **Identity-based** — on the WHO ("this role may write to Bookings")
- **Resource-based** — on the resource ("this Lambda may be invoked by this API Gateway")
- **Trust policy** — on a role, says who may borrow it ("Lambda service may assume this role")

### Pulumi preview

```ts
// Step 1: role that only the Lambda service can borrow (trust policy)
const bookingRole = new aws.iam.Role("booking-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});

// Step 2: two actions on one table only (least privilege)
new aws.iam.RolePolicy("booking-policy", {
  role: bookingRole.id,
  policy: bookingsTable.arn.apply(arn => JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: ["dynamodb:PutItem", "dynamodb:UpdateItem"], Resource: arn }],
  })),
});
```

---

## 4. Securing the AWS account

What we did and why:

| Done | Why |
|---|---|
| MFA on root, no root access keys | Root can close the account; protect it, never use daily |
| Zero-spend budget + $5 monthly budget | Email alert on any surprise cost (alerts can be hours late) |
| Free Tier usage alerts on | Warning before free limits run out |
| `admins` group with AdministratorAccess | Permissions on groups, not people |
| IAM user `mahesh-dev` + MFA | Daily login; logs show who did what |

### Gotcha we hit — IAM Identity Center

- Best practice for humans = **IAM Identity Center + AWS Organizations** (short-lived credentials).
- But **creating an Organization upgrades a Free-plan account to paid, and free credits expire immediately.**
- So for a personal free account → **IAM user + MFA** is the right choice.
- Our account is on the **newer Free plan with credits** → careful with RDS, OpenSearch, Redis later.

---

## 5. Credentials and profiles

**Easy meaning:** the console uses a password in a browser. Programs (CLI, Pulumi) can't type passwords, so they use an **access key** (key ID + secret) to sign every request.

**Profile** = a named set of credentials + settings, stored on the laptop:

```ini
# ~/.aws/credentials — the secret part
[ticketlite]
aws_access_key_id = AKIA...
aws_secret_access_key = ...

# ~/.aws/config — the settings part
[profile ticketlite]
region = us-east-1
output = json
```

Commands:

```bash
aws configure --profile ticketlite               # save key + region
aws configure list --profile ticketlite          # check (secret hidden)
aws sts get-caller-identity --profile ticketlite # "who am I?" test
```

### Access key rules

- Lives only in `~/.aws/credentials` — never in code, `.env`, git or chat
- Leaked → delete in console immediately, create new
- Delete when the project ends
- **Lambdas never use access keys** — they use roles with temporary credentials

---

## 6. Pulumi — infrastructure as code

**Easy meaning:** every AWS resource is written as TypeScript code, so it's versioned, reviewable and repeatable.

```
Pulumi code (index.ts) ──► Pulumi Cloud (state: what exists)
        │
        ▼
Profile ticketlite (access key)
        │
        ▼
IAM check: is mahesh-dev allowed?
        │
        ▼
Resource created in us-east-1
```

### Key words

- **State** — Pulumi's record of everything it created. Lets it change only the difference. Stored in Pulumi Cloud.
- **Stack** — one copy of the infrastructure (`dev` now, `prod` later, same code).
- **Config** — per-stack settings, e.g. `aws:region`, `aws:profile`.

### Setup we did

```bash
pulumi login                              # where state is stored
cd infra && pulumi new aws-typescript     # project ticketlite-infra, stack dev, pnpm, us-east-1
pulumi config set aws:profile ticketlite  # which AWS key to use
```

### The core cycle

```bash
pulumi preview   # what WOULD change — touches nothing
pulumi up        # create / update for real
pulumi destroy   # remove everything in this stack (cost safety)
```

Tested with one S3 bucket: created → seen in console → destroyed.

### Project skeleton

```
ticketlite/
  web/        → Next.js frontend
  api/        → Fastify REST API (runs in Lambda)
  functions/  → small single-job Lambdas
  infra/      → Pulumi code
  notes/      → these notes
```

---

## 7. Interview answer scripts

**Q: What is serverless?**
> "Serverless means I don't manage servers or capacity. I give AWS my code and configuration, it runs only when an event comes in, scales automatically, and I pay per use. In my app, a booking request hits API Gateway, which invokes a Lambda that writes to DynamoDB. Benefits are no ops work, automatic scaling and zero idle cost. Trade-offs are cold starts, the 15-minute limit, statelessness and vendor lock-in, so for long-running or constant heavy workloads I'd consider containers."

**Q: How do you make an app highly available on AWS?**
> "AWS regions have multiple Availability Zones, which are physically separate data centres. High availability means surviving an AZ failure. Serverless services like Lambda, DynamoDB and S3 are multi-AZ by default, so my app survives an AZ outage without extra work. Surviving a region outage is disaster recovery — DynamoDB Global Tables and Route 53 failover — which I'd only add when the business cost of downtime justifies it."

**Q: Explain IAM and least privilege.**
> "IAM controls who can do what on which resource. Everything is denied by default, an explicit allow grants access, and an explicit deny always wins. Each Lambda in my app has its own execution role with a least-privilege policy — the booking function can only put and update items in the Bookings table. Roles give temporary, auto-rotating credentials, so there are no access keys in code. For API Gateway calling Lambda, I use a resource-based policy."

**Q: How do you secure an AWS account?**
> "MFA on root and never use it daily, budget alerts, and short-lived credentials for humans through IAM Identity Center. Workloads use IAM roles with least privilege, never long-lived keys. In a team I'd separate dev and prod into different accounts under AWS Organizations. For a single personal account, an IAM user with MFA is acceptable, with access keys kept out of code and rotated."

**Q: Why infrastructure as code? Why Pulumi?**
> "All infrastructure is code, so it's version-controlled, reviewed in PRs, and reproducible across dev and prod stacks. Pulumi tracks state, and `pulumi preview` shows exactly what will change before applying, like a Terraform plan. I chose Pulumi because I can use real TypeScript — types, loops, shared code — in the same language as the app."

---

## 8. Recall card

| Concept | One line |
|---|---|
| Serverless | No servers to manage, runs on events, auto-scales, pay per use |
| Cold start | First request after idle is slower |
| Stateless | No data in variables — use DB or cache |
| Region | Geographic area, fully separate (`us-east-1`) |
| AZ | Separate data centre(s) inside a region |
| HA | Survive an AZ failure — serverless gives it by default |
| DR | Survive a region failure — Global Tables + Route 53 failover |
| IAM rule | Default deny → allow opens → deny wins |
| Least privilege | Only what's needed, small blast radius |
| Role | Borrowed identity, temporary keys (Lambdas use these) |
| ARN | Full unique address of an AWS resource |
| Access key | Program's password — never in code |
| Profile | Named credentials + region on the laptop |
| Pulumi state | Record of what exists |
| Stack | One copy of the infra (dev / prod) |
| `preview / up / destroy` | Look → create → remove |