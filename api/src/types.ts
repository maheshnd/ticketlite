// The Fastify instance type used across the app: a normal Fastify app, plus the Zod type provider.
// With the provider, `request.body`, `request.query` and `request.params` get their TypeScript types
// straight from the route's Zod schemas, so validation and types can never disagree.
import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;
