// Exported as 404.html. CloudFront returns it for any path that has no file in S3.
import Link from "next/link";

export default function NotFound() {
  return (
    <section aria-labelledby="nf-title">
      <h1 id="nf-title" className="text-2xl font-bold">
        Page not found
      </h1>
      <p className="mt-2">
        <Link href="/" className="text-indigo-700 underline">
          Back to events
        </Link>
      </p>
    </section>
  );
}
