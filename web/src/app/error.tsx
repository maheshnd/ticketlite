"use client";
// The app-wide error boundary: a rendering error anywhere below the root layout lands here instead of a
// blank page. Next.js wraps each route segment in its own boundary when a folder has an error.tsx.
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-slate-700">{error.message}</p>
      <button type="button" onClick={reset} className="self-start rounded bg-indigo-700 px-4 py-2 text-white">
        Try again
      </button>
    </section>
  );
}
