// Home page. M1 skeleton: proves the static export, S3 upload and CloudFront routing work.
// M2 replaces it with the events list (React Query + infinite scroll).
export default function HomePage() {
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title" className="text-2xl font-bold">
        Upcoming events
      </h1>
      <p className="mt-2 text-slate-700">The events list arrives in milestone M2.</p>
    </section>
  );
}
