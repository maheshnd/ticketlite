// Tests the CloudFront Function in cdn-rewrite.js without deploying it.
// The file is a plain script (CloudFront calls `handler` by name), so we load it as text and evaluate it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type CfRequest = { uri: string };
const code = readFileSync(join(__dirname, "cdn-rewrite.js"), "utf8");
const handler = new Function(`${code}; return handler;`)() as (e: { request: CfRequest }) => CfRequest;
const rewrite = (uri: string) => handler({ request: { uri } }).uri;

describe("cdn-rewrite", () => {
  it("maps / to /index.html", () => expect(rewrite("/")).toBe("/index.html"));
  it("adds .html to a page path", () => expect(rewrite("/event")).toBe("/event.html"));
  it("handles a trailing slash", () => expect(rewrite("/admin/events/")).toBe("/admin/events.html"));
  it("leaves files with an extension alone", () => {
    expect(rewrite("/_next/static/chunks/app.js")).toBe("/_next/static/chunks/app.js");
  });
});
