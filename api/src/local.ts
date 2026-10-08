// Local development only: run the same app as a normal HTTP server on port 3000.
// `pnpm --filter @ticketlite/api dev` runs this with tsx watch, which restarts it whenever a file changes.
import { buildApp } from "./app";

const app = await buildApp();

// host 0.0.0.0 lets other devices or containers reach it. http://localhost:3000/api/health works too.
app.listen({ port: 3000, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
