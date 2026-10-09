// Guard: every Fastify route under /api must be listed in infra/http-route-list.ts, and every listed route must
// have a Fastify handler. In AWS, API Gateway answers 404 for any path that is not listed, so a route that
// works locally can be unreachable after deploy (this happened to GET /api/search and /api/admin/reports).
// See docs/adr/0011-explicit-http-routes.md.
import type { RouteOptions } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { protectedRoutes, publicRoutes, sqlRoutes } from "../../infra/http-route-list";

// Step 1: build the app as it runs in the "dev" stage, so the Swagger docs routes exist too (they are
// switched off in the "test" stage). config.ts reads the env once, at import, hence the dynamic import.
vi.stubEnv("STAGE", "dev");
const { buildApp } = await import("../src/app");

// Step 2: write both kinds of route in one shape: "GET /api/events/{param}".
//   Fastify:     "/api/events/:id"  -> "/api/events/{param}",  "/api/docs/*"       -> "/api/docs/{proxy+}"
//   API Gateway: "/api/events/{id}" -> "/api/events/{param}",  "/api/docs/{proxy+}" stays as it is
// Parameter names don't matter to API Gateway, only the number of path segments.
const fromFastify = (method: string, url: string) =>
  `${method} ${url.replace(/:[^/]+/g, "{param}").replace(/\*$/, "{proxy+}")}`;
const fromInfra = (routeKey: string) => routeKey.replace(/\{[^}+]+\}/g, "{param}");

// A "{proxy+}" route covers every path below its prefix, e.g. "GET /api/docs/{proxy+}" covers "GET /api/docs/json".
const covers = (pattern: string, route: string) =>
  pattern === route ||
  (pattern.endsWith("/{proxy+}") && route.startsWith(pattern.slice(0, -"{proxy+}".length)));

async function fastifyRoutes(): Promise<string[]> {
  const routes: string[] = [];
  const app = await buildApp({
    onRoute: (route: RouteOptions) => {
      for (const method of [route.method].flat()) {
        // Fastify adds a HEAD route for every GET by itself; partner routes (/partner) are served by the
        // separate partner REST API (infra/partner-api.ts), not the HTTP API.
        if (method !== "HEAD" && route.url.startsWith("/api")) routes.push(fromFastify(method, route.url));
      }
    },
  });
  await app.close();
  return [...new Set(routes)];
}

describe("HTTP API routes (infra/http-route-list.ts) match the Fastify app", () => {
  // The SQL route is created only with enableSql, but it must still be listed (and have a handler).
  const infraRoutes = [...publicRoutes, ...protectedRoutes, ...sqlRoutes].map(fromInfra);

  it("lists every Fastify route, so API Gateway forwards it", async () => {
    const missing = (await fastifyRoutes()).filter((route) => !infraRoutes.some((p) => covers(p, route)));
    expect(
      missing,
      `These Fastify routes are missing from infra/http-route-list.ts, so API Gateway would answer 404 ` +
        `for them in AWS. Add each one to publicRoutes or protectedRoutes (JWT authorizer):\n  ${missing.join("\n  ")}\n`,
    ).toEqual([]);
  });

  it("has a Fastify handler for every listed route", async () => {
    const routes = await fastifyRoutes();
    const orphans = infraRoutes.filter((pattern) => !routes.some((route) => covers(pattern, route)));
    expect(
      orphans,
      `These routes in infra/http-route-list.ts have no Fastify handler (a typo, or a removed route). ` +
        `Fix or remove them:\n  ${orphans.join("\n  ")}\n`,
    ).toEqual([]);
  });

  it("lists no route twice", () => {
    expect(new Set(infraRoutes).size).toBe(infraRoutes.length);
  });
});
