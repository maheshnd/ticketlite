// Returns `value`, but only after it has stopped changing for `delayMs`. Typing "jazz" fires ONE search,
// not four (j, ja, jaz, jazz). CONCEPT: debouncing
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer); // a new keystroke cancels the pending update
  }, [value, delayMs]);
  return debounced;
}
