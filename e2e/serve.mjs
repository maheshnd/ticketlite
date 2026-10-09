// A tiny static server for web/out, used by Playwright. It applies the SAME URL rewrite as the CloudFront
// Function (infra/cdn-rewrite.js), so E2E tests also prove that "/event?id=..." finds event.html.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const root = join(import.meta.dirname, "..", "web", "out");
const rewriteCode = readFileSync(join(import.meta.dirname, "..", "infra", "cdn-rewrite.js"), "utf8");
const rewrite = new Function(`${rewriteCode}; return handler;`)();
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".txt": "text/plain",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const { uri } = rewrite({ request: { uri: decodeURIComponent(url.pathname) } });
  const file = join(root, uri);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/html" });
    return createReadStream(join(root, "404.html")).pipe(res);
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT ?? 4173));
