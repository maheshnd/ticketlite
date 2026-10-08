// Next.js settings. The whole site is exported as plain HTML/JS/CSS files (no Node server),
// uploaded to S3 and served by CloudFront. See docs/adr for static export vs SSR.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Step 1: `next build` writes the static site to web/out.
  output: "export",
  // Step 2: the Next.js image optimizer needs a server, so images are served as-is.
  images: { unoptimized: true },
  // Step 3: compile the shared Zod schemas (TypeScript source) like our own code.
  transpilePackages: ["@ticketlite/shared"],
};

export default nextConfig;
