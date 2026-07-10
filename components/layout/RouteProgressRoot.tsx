"use client";

import { Suspense, type ReactNode } from "react";

import { RouteProgressProvider } from "@/src/components/navigation/RouteProgressProvider";

/**
 * Root-mounted navigation progress (fixed top bar).
 * Suspense required because the provider reads `useSearchParams`.
 */
export function RouteProgressRoot({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <RouteProgressProvider>{children}</RouteProgressProvider>
    </Suspense>
  );
}
