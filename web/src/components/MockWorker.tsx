"use client";
// Starts MSW's service worker, then tells MockGate it's ready. Loaded with next/dynamic + ssr:false, because
// "msw/browser" only exists for browsers (its package.json maps it to null for Node, where the static pages
// are prerendered).
import { useEffect } from "react";
import { worker } from "../mocks/browser";

export default function MockWorker({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    void worker.start({ onUnhandledFrame: "bypass", quiet: true }).then(onReady);
  }, [onReady]);
  return null;
}
