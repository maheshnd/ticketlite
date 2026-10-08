# Security

Where TicketLite handles each risk. Every row points at the code that does it.

## Threats and defences

| Risk | What it is | How TicketLite handles it | Where |
|---|---|---|---|
| **XSS** (cross-site scripting) | Attacker-controlled text runs as script in a victim's page | React escapes everything it renders; no `dangerouslySetInnerHTML`. A Content-Security-Policy allows scripts only from our origin. The access token lives in memory (not localStorage) and the refresh token is HttpOnly, so XSS can't steal a long-lived session | `infra/cdn.ts` (CSP), `web/src/lib/token-store.ts`, `api/src/routes/auth.ts` |
| **CSRF** (cross-site request forgery) | Another site makes the browser send a request with our cookies | Refresh cookie is `SameSite=Strict` + `Path=/api/auth`; `refresh`/`logout` also require the `x-csrf: 1` header (a cross-site form can't set it; a cross-site fetch would need a CORS preflight we refuse). Everything else uses a Bearer token, which browsers never attach automatically | `api/src/routes/auth.ts` |
| **CORS misconfiguration** | Letting other origins read our responses | Production is same-origin (CloudFront serves web + API), so no CORS at all; CORS allows only the local dev origin, never `*` with credentials | `infra/http-api.ts`, `api/src/plugins/cors.ts` |
| **SSRF** (server-side request forgery) | Tricking the server into fetching an attacker-chosen URL | The API never fetches user-supplied URLs. Outbound calls go to fixed AWS endpoints or the Cognito domain from config | `api/src/lib/*` |
| **NoSQL injection** | User input changing a DynamoDB expression | Expressions are constants; user values are always passed as `ExpressionAttributeValues` (placeholders), field names as `ExpressionAttributeNames`. Zod validates every input first. Pagination cursors are decoded and type-checked | `api/src/repositories/*`, `api/src/repositories/cursor.ts` |
| **SQL injection** | User input changing a SQL statement | Drizzle's query builder sends every value as a bound parameter (the test checks `params`); no string-built SQL | `packages/sql/src/reports.ts` |
| **Broken access control / IDOR** | Reading or changing someone else's data by guessing ids | Bookings are filtered by the token's `sub`; another user's booking id gets 404. Admin routes check the `admin` group (RBAC) on the server, in REST and in AppSync | `api/src/services/bookings-service.ts`, `api/src/plugins/auth-context.ts`, `graphql/resolvers/fn-check-admin.ts` |
| **Broken authentication** | Weak passwords, stolen tokens | Cognito: password policy, hashing, email verification, user-enumeration protection. JWTs verified twice (API Gateway authorizer + `aws-jwt-verify`). 15-minute access tokens, revocable refresh tokens | `infra/cognito.ts`, `api/src/lib/jwt.ts` |
| **Token storage** | Where the browser keeps credentials | Access token: JS memory only. Refresh token: HttpOnly + Secure + SameSite=Strict cookie. Nothing in localStorage | `web/src/lib/token-store.ts` |
| **File upload abuse** | Huge or malicious files | Presigned POST with size + content-type conditions enforced by S3; the server picks the key; poster-processor checks magic bytes and deletes anything else | `api/src/lib/s3.ts`, `functions/poster-processor` |
| **Security misconfiguration** | Public buckets, missing headers | Buckets block all public access, readable only by our CloudFront distribution (OAC + `AWS:SourceArn`). HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` on every response. Swagger docs off outside dev | `infra/storage.ts`, `infra/cdn.ts`, `api/src/plugins/swagger.ts` |
| **Sensitive data exposure** | Leaking secrets or internals | Secrets only in Secrets Manager (read at runtime, cached); 500s never include error messages; logs redact `authorization` and `cookie`; encryption at rest everywhere (DynamoDB, S3, SQS, OpenSearch, Aurora) and TLS in transit | `infra/secrets.ts`, `api/src/plugins/error-handler.ts`, `api/src/app.ts` |
| **Abuse / DoS / cost attacks** | Floods of requests | API Gateway throttling (stage + bookings route), per-user Redis rate limit, AppSync query depth limit, partner usage plans with daily quotas, WAF rate rule per IP (flag) | `infra/http-routes.ts`, `api/src/services/rate-limit-service.ts`, `infra/appsync.ts`, `infra/partner-api.ts`, `infra/waf.ts` |
| **Vulnerable dependencies / supply chain** | Malicious or vulnerable packages | One lockfile, `--frozen-lockfile` in CI, pnpm blocks install scripts by default (`allowBuilds` lists the exceptions), current versions | `pnpm-workspace.yaml`, `.github/workflows/*` |
| **Over-privileged identities** | A compromised component can do too much | One IAM role per Lambda with only its actions on its resources; the AppSync IAM mutation is callable only by the saga roles; CI uses OIDC (no long-lived keys): read-only role for PRs, deploy role for `main` only | `infra/iam.ts`, `bootstrap/roles.ts` |
| **Logging and monitoring failures** | Attacks or errors nobody notices | Structured logs with correlation IDs, X-Ray traces, alarms on 5xx, Lambda errors/throttles, failed sagas and any DLQ message | `infra/observability.ts` |

## Known gaps (deliberate, documented)

- **The API Gateway URL is reachable directly**, bypassing CloudFront and WAF. Fix: CloudFront adds a secret
  origin header that the API checks (rotated via Secrets Manager), or a private origin via VPC origins.
- **The deploy role is AdministratorAccess** (see `bootstrap/roles.ts` for why and what a company would do instead).
- **Introspection is on** in AppSync (dev only).
- **The AppSync API key is public by design** (it ships in the web app); it only grants public reads.

## Passwords

TicketLite never stores or sees password hashes. Cognito stores them (salted, slow hashing via SRP verifiers) and
enforces the policy, lockouts and rate limits. The BFF forwards the password once, over HTTPS, and never logs it.

## OWASP Top 10 (2021) mapping

A01 Broken Access Control → IDOR + RBAC rows · A02 Cryptographic Failures → encryption + token storage rows ·
A03 Injection → NoSQL/SQL rows · A04 Insecure Design → saga + idempotency (docs/adr) · A05 Security
Misconfiguration → misconfiguration row · A06 Vulnerable Components → supply-chain row · A07 Identification and
Authentication Failures → authentication row · A08 Software and Data Integrity → CI with OIDC, frozen lockfile ·
A09 Logging and Monitoring → monitoring row · A10 SSRF → SSRF row.
