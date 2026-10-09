"use client";
// E2E mock mode only: starts MSW in the browser BEFORE the app renders, so the first requests are mocked.
// In a normal build NEXT_PUBLIC_MOCK is not "1", so MockWorker is never rendered and MSW never loads.
// CONCEPT: api-mocking
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";
const MockWorker = dynamic(() => import("./MockWorker"), { ssr: false });

export function MockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!MOCK);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <>
      {MOCK && !ready && <MockWorker onReady={onReady} />}
      {ready && children}
    </>
  );
}
