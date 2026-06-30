import type { Metadata } from "next";

import { DesignSystemShowcase } from "./DesignSystemShowcase";

export const metadata: Metadata = {
  title: "FI Network UI — internal design system",
  description: "Internal preview of shared Follicle Intelligence Network UI primitives.",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/50 bg-muted/10 py-4">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Internal
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
            Follicle Intelligence Network UI
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Preview surface for shared marketing primitives. Not indexed for search. Safe to remove
            or protect behind auth in production.
          </p>
        </div>
      </div>
      <DesignSystemShowcase />
    </main>
  );
}
