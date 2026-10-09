// The list of HTTP API routes, as plain data (no Pulumi imports).
// http-routes.ts turns these into API Gateway routes. api/test/http-routes.test.ts imports the same lists and
// fails if a Fastify route is missing here (API Gateway would answer 404 in AWS) or a route here has no
// Fastify handler. Why explicit routes and not one catch-all: docs/adr/0011-explicit-http-routes.md.
// Route keys use API Gateway's syntax: "{id}" is one path segment, "{proxy+}" is any number of segments.

// Step 1: PUBLIC routes: anyone may call them.
export const publicRoutes = [
  "GET /api/health",
  "GET /api/copy-info",
  "GET /api/docs",
  "GET /api/docs/{proxy+}",
  "GET /api/events",
  "GET /api/events/{id}",
  "GET /api/search", // public data, like the events list
  // Auth endpoints are public by nature (you have no token yet). refresh/logout use the HttpOnly cookie.
  "POST /api/auth/signup",
  "POST /api/auth/confirm",
  "POST /api/auth/login",
  "POST /api/auth/refresh",
  "POST /api/auth/logout",
  "POST /api/auth/forgot",
  "POST /api/auth/reset",
  "GET /api/auth/oauth/start",
  "GET /api/auth/oauth/callback",
  // The session demo uses its own cookie, not a JWT.
  "POST /api/demo/session/login",
  "GET /api/demo/session/me",
  "POST /api/demo/session/logout",
];

// Step 2: PROTECTED routes: API Gateway rejects them with 401 unless the JWT authorizer passes.
// Finer rules (admin group, "only your own booking") are checked in Fastify. CONCEPT: rbac
export const protectedRoutes = [
  "GET /api/me",
  "POST /api/bookings",
  "GET /api/bookings",
  "GET /api/bookings/{id}",
  "GET /api/admin/events",
  "POST /api/admin/events",
  "GET /api/admin/events/{id}",
  "PUT /api/admin/events/{id}",
  "POST /api/admin/uploads/poster",
];

// Step 3: PROTECTED routes that exist only with the enableSql flag. With the flag off there is no database,
// so API Gateway answers 404 itself (the web's Reports page shows "SQL reporting is switched off").
export const sqlRoutes = ["GET /api/admin/reports"];
