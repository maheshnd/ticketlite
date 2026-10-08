// GET /api/me: who am I? Protected twice: API Gateway's JWT authorizer, then requireUser here.
import { MeSchema } from "@ticketlite/shared";
import { currentUser, requireUser } from "../plugins/auth-context";
import { getEmail } from "../services/auth-service";
import type { App } from "../types";

export function meRoutes(app: App) {
  app.get(
    "/me",
    { preHandler: requireUser, schema: { response: { 200: MeSchema } } },
    async (request, reply) => {
      const user = currentUser(request);
      reply.header("cache-control", "private, no-store"); // personal data: never cache in shared caches
      return { userId: user.userId, email: await getEmail(user.accessToken), groups: user.groups };
    },
  );
}
