// The submit button every form uses: disabled while the request runs (no double submits), with an
// optional "busy" label so screen-reader and sighted users both know something is happening.
// `className` is for layout only (e.g. "self-start"); the look stays the same everywhere.
type Props = { submitting: boolean; busyLabel?: string; className?: string; children: React.ReactNode };

export function SubmitButton({ submitting, busyLabel, className = "", children }: Props) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className={`rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-60 ${className}`}
    >
      {submitting && busyLabel ? busyLabel : children}
    </button>
  );
}
