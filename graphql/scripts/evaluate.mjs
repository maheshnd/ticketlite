// Runs every built resolver's request() and response() inside the REAL AppSync JS runtime, using the
// read-only `aws appsync evaluate-code` API. It catches code that type-checks but that APPSYNC_JS does not
// support (classes, try/catch, ++, ...). Needs AWS credentials:
//   pnpm --filter @ticketlite/graphql build && AWS_PROFILE=ticketlite pnpm --filter @ticketlite/graphql evaluate
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

// A context rich enough for every resolver: arguments, an identity, a source event and a result.
const context = JSON.stringify({
  arguments: {
    id: "evt-1",
    city: "Pune",
    limit: 5,
    eventId: "evt-1",
    input: { name: "x", version: 1, totalSeats: 10, eventId: "evt-1", availableSeats: 3 },
  },
  identity: { sub: "user-1", groups: ["admin"] },
  source: { organizerId: "org-1" },
  result: { items: [], nextToken: null, status: "PUBLISHED" },
  prev: { result: {} },
});

let failed = 0;
for (const file of readdirSync("dist")) {
  for (const fn of ["request", "response"]) {
    const output = JSON.parse(
      execFileSync("aws", [
        "appsync",
        "evaluate-code",
        "--region",
        "us-east-1",
        "--runtime",
        "name=APPSYNC_JS,runtimeVersion=1.0.0",
        "--code",
        `file://dist/${file}`,
        "--function",
        fn,
        "--context",
        context,
      ]).toString(),
    );
    // util.unauthorized() in fn-check-admin is an expected "error" only for non-admins; here we are admin.
    const ok = !output.error;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${file} ${fn}${ok ? "" : `: ${output.error.message}`}`);
  }
}
process.exit(failed ? 1 : 0);
