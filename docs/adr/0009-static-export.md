# 0009 — Next.js static export on S3 + CloudFront (not SSR/ISR)

- **Status:** accepted
- **Date:** 2026-10-08

## Context

Next.js can run as a server (SSR, ISR, React Server Components with data fetching, middleware) or be exported as
static files (`output: "export"`). On AWS, the server modes need Amplify Hosting, OpenNext (Lambda + CloudFront + S3),
or containers.

## Decision

**Static export** to `web/out`, uploaded to a private S3 bucket and served by CloudFront with Origin Access Control.
All data is fetched in the browser with React Query. Dynamic pages use query strings (`/event?id=...`); a CloudFront
Function maps `/event` to `event.html`.

## Alternatives

**SSR/ISR with OpenNext or Amplify Hosting.**
- \+ HTML arrives with data: better first paint, SEO for event pages, social previews per event.
- \+ ISR caches rendered pages and refreshes them in the background.
- − A server tier to run, cold starts on page renders, more moving parts (OpenNext's image optimizer, revalidation
  queue, cache table); Amplify Hosting abstracts it but is another service to learn.

## Consequences

- No server to pay for or scale for the web tier; CloudFront serves everything from the edge.
- Pretty URLs like `/event/evt-001` are not possible without a server or a rewrite map: we use `?id=`.
- SEO/social previews for individual events are weak (the HTML has no event data). For a high-traffic B2C portal where
  search traffic matters, SSR/ISR (OpenNext or Amplify) would be the better choice; the API and data layer wouldn't
  change.
- Core Web Vitals: LCP depends on the API call after JS loads. Mitigations used: small route bundles (code
  splitting), cached API list (CloudFront 30 s), prefetch on hover. Measure with Lighthouse / PageSpeed Insights and
  the `web-vitals` library (see docs/LEARNING-PATH.md, topic 11).
