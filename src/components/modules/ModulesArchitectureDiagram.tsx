"use client";

import dynamic from "next/dynamic";

const ArchitectureDiagramDynamic = dynamic(
  () =>
    import("@/components/ui/architecture-diagram").then((m) => ({
      default: m.ArchitectureDiagram,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[320px] w-full rounded-xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-fi-panel"
        aria-hidden
      />
    ),
  }
);

export function ModulesArchitectureDiagram() {
  return <ArchitectureDiagramDynamic />;
}
