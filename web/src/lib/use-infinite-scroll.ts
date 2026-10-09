// Infinite scroll: returns a ref for a "sentinel" element at the end of a list; when it scrolls into view,
// the next page loads. IntersectionObserver is the browser's cheap way to ask "is this element visible?"
// (no scroll listeners). Lists still show a real "Load more" button for keyboard users. CONCEPT: pagination
import { useEffect, useRef } from "react";

type Pages = { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => Promise<unknown> };

export function useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage }: Pages) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(element);
    return () => observer.disconnect(); // stop watching when the list changes or unmounts
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return sentinel;
}
