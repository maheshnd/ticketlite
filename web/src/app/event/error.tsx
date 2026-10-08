"use client";
// The event page's own error boundary: an error here keeps the header and navigation working.
export default function EventError({ error, reset }: { error: Error; reset: () => void }) {
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
