// The city aggregation from the search response, as toggle buttons ("Pune (3)"). aria-pressed tells
// assistive tech which one is active. CONCEPT: aggregations, accessibility
import type { SearchResponse } from "@ticketlite/shared";

type Props = {
  cities: SearchResponse["cities"];
  selected: string | undefined;
  onSelect: (city: string | undefined) => void;
};

const buttonClass = "rounded border px-3 py-1 aria-pressed:bg-indigo-700 aria-pressed:text-white";

export function CityFilters({ cities, selected, onSelect }: Props) {
  return (
    <div role="group" aria-label="Filter by city" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={!selected}
        onClick={() => onSelect(undefined)}
        className={buttonClass}
      >
        All
      </button>
      {cities.map((c) => (
        <button
          key={c.city}
          type="button"
          aria-pressed={selected === c.city}
          onClick={() => onSelect(c.city)}
          className={buttonClass}
        >
          {c.city} ({c.count})
        </button>
      ))}
    </div>
  );
}
