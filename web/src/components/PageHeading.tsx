"use client";
// A page's <h1>. It takes keyboard focus when the page mounts, so screen-reader and keyboard users
// start at the new page's title after a client-side navigation. CONCEPT: accessibility
import { useEffect, useRef } from "react";

export function PageHeading({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h1 ref={ref} tabIndex={-1} className="text-2xl font-bold outline-none">
      {children}
    </h1>
  );
}
