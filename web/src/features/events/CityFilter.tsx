// The city filter above the events list. role="search" makes it a landmark that screen readers can jump
// to. An empty box means "all cities". CONCEPT: accessibility
import { useState } from "react";

export function CityFilter({ onFilter }: { onFilter: (city: string | undefined) => void }) {
  const [cityInput, setCityInput] = useState("");
  return (
    <form
      role="search"
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onFilter(cityInput.trim() || undefined);
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="city">City</label>
        <input
          id="city"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder="e.g. Pune"
          className="rounded border border-slate-400 p-2"
        />
      </div>
      <button type="submit" className="rounded bg-indigo-700 px-4 py-2 text-white">
        Filter
      </button>
    </form>
  );
}
