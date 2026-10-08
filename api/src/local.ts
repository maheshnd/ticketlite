import { buildApp } from "./app.js";

// Local development only: run the same app as a normal HTTP server.
// `pnpm dev` runs this with tsx watch, which restarts it whenever a file changes.
const app = buildApp();

// host 0.0.0.0 lets other devices or containers reach it. localhost:3000 works too.
app.listen({ port: 3000, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
