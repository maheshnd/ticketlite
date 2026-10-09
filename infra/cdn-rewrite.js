// CloudFront Function (runtime cloudfront-js-2.0), run on every viewer request to the WEB bucket.
// Next.js static export writes one HTML file per page ("/event" -> "event.html"), but S3 only serves
// exact keys. This maps pretty URLs to those files:
//   "/"        -> "/index.html"
//   "/event"   -> "/event.html"     (the query string "?id=..." is kept, the page reads it in the browser)
//   "/admin/events/" -> "/admin/events.html"
// Paths with a file extension ("/_next/static/x.js", "/favicon.ico") pass through unchanged.
// CONCEPT: static-export
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- CloudFront calls `handler` by name
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/") {
    request.uri = "/index.html";
  } else if (uri.endsWith("/")) {
    request.uri = uri.slice(0, -1) + ".html";
  } else if (!uri.split("/").pop().includes(".")) {
    request.uri = uri + ".html";
  }
  return request;
}
