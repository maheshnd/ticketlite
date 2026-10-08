# 0006 — GraphQL client: typed fetch + a hand-written AppSync WebSocket client

- **Status:** accepted
- **Date:** 2026-10-08

## Context

The web app needs (1) a few AppSync queries and (2) one subscription (`onSeatUpdate`). The spec asks for "the
current recommended lightweight approach … that lets us pass our own Cognito access token". The access token
lives in memory (BFF pattern, see `web/src/lib/token-store.ts`); the app does not use Amplify Auth.

AppSync GraphQL subscriptions use AppSync's own WebSocket protocol (auth passed as a base64 header in the URL and
in each `start` message), not the standard `graphql-ws`/`graphql-transport-ws` protocols, so generic clients
(Apollo + `graphql-ws`, urql) need AppSync-specific links to work.

## Decision

- **Queries:** plain `fetch` (`web/src/lib/appsync.ts`) with documents typed by **GraphQL Code Generator**
  (`client` preset, `documentMode: "string"`), so no GraphQL runtime library ships to the browser.
- **Subscriptions:** a ~100-line hand-written client for AppSync's real-time protocol
  (`web/src/lib/appsync-realtime.ts`): connection_init/ack, start/start_ack, data, keep-alive and reconnect with
  backoff.
- **Auth:** `Authorization: <access token>` when logged in, otherwise `x-api-key` (public reads).
- **Cache:** results go into React Query; subscription data is written with `setQueryData`.

## Alternatives

- **Amplify JS (`aws-amplify` + `generateClient`)**: the officially supported AppSync client. Handles the protocol,
  reconnects and auth modes. But it expects Amplify to own auth (or a `lambda`/`oidc` mode with custom tokens), adds a
  large dependency and configuration, and hides exactly the protocol details this project wants to teach.
- **Apollo Client / urql + AppSync links** (`aws-appsync-subscription-link`): rich caching, but a second cache next to
  React Query, plus link packages that lag behind.
- **AppSync Events** (a newer AppSync product for pub/sub over WebSockets): simpler channels, but it is not GraphQL;
  the spec asks for GraphQL subscriptions.

## Consequences

- Small bundle; every protocol step is readable and testable (MSW 3 mocks the WebSocket in
  `web/src/mocks/handlers.ts`, and `live-seats.test.tsx` runs the real client against it).
- We own the edge cases: reconnect, token expiry on long-lived sockets (a reconnect picks up the refreshed token),
  multiplexing several subscriptions on one socket (not needed here). For many subscriptions per page, Amplify
  would be the pragmatic choice.
