// The inputs of the event form. Each text input is listed once below and rendered with the same accessible
// TextField (label, aria-invalid, linked error message). CONCEPT: accessibility
import { TextField } from "../../components/TextField";

const textFields = [
  { id: "name", label: "Name" },
  { id: "description", label: "Description" },
  { id: "city", label: "City" },
  { id: "venue", label: "Venue" },
  { id: "startsAt", label: "Starts at (UTC)", type: "datetime-local" },
  { id: "price", label: "Price (INR)", type: "number" },
  { id: "totalSeats", label: "Total seats", type: "number" },
];

type Props = {
  values: Record<string, string>;
  errors: Record<string, string>;
  setValue: (field: string) => (value: string) => void;
};

export function EventFields({ values, errors, setValue }: Props) {
  return (
    <>
      {textFields.map((field) => (
        <TextField
          key={field.id}
          id={field.id}
          label={field.label}
          type={field.type}
          value={values[field.id] ?? ""}
          error={errors[field.id]}
          onChange={setValue(field.id)}
        />
      ))}
      <div className="flex flex-col gap-1">
        <label htmlFor="status">Status</label>
        <select
          id="status"
          value={values.status}
          onChange={(e) => setValue("status")(e.target.value)}
          className="rounded border border-slate-400 p-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>
    </>
  );
}
