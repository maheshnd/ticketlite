// A form-level message (e.g. "Wrong email or password"). role="alert" makes screen readers announce it
// as soon as it appears, without the user having to find it.
export function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
      {message}
    </p>
  );
}
