// A labelled input with an accessible error message. CONCEPT: accessibility
//   - <label htmlFor> ties the visible label to the input,
//   - aria-invalid tells assistive tech the value is wrong,
//   - aria-describedby makes screen readers read the error right after the label.
type Props = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function TextField({ id, label, type = "text", autoComplete, value, error, onChange }: Props) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded border border-slate-400 p-2 aria-invalid:border-red-700"
      />
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
