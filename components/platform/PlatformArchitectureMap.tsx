"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type PlatformArchitectureModuleId =
  | "leadflow"
  | "clinic-os"
  | "patient-os"
  | "consultation-os"
  | "imaging-os"
  | "surgery-os"
  | "audit-os"
  | "academy-os"
  | "analytics-os";

type ModuleDef = {
  id: PlatformArchitectureModuleId;
  name: string;
  layer: string;
  description: string;
  connectsTo: PlatformArchitectureModuleId[];
  href: string;
};

const MODULES: ModuleDef[] = [
  {
    id: "leadflow",
    name: "LeadFlow",
    layer: "Lead Layer",
    description: "Captures and converts every patient enquiry.",
    connectsTo: ["clinic-os", "patient-os", "analytics-os"],
    href: "/platform/leadflow",
  },
  {
    id: "clinic-os",
    name: "ClinicOS",
    layer: "Operations Layer",
    description: "Runs scheduling, services, staff calendars and clinic workflow.",
    connectsTo: ["leadflow", "patient-os", "consultation-os", "analytics-os"],
    href: "/platform/clinic-os",
  },
  {
    id: "patient-os",
    name: "PatientOS",
    layer: "Patient Intelligence Layer",
    description: "Creates the unified patient record and Patient Twin™.",
    connectsTo: ["clinic-os", "consultation-os", "imaging-os", "surgery-os", "audit-os"],
    href: "/platform/patient-os",
  },
  {
    id: "consultation-os",
    name: "ConsultationOS",
    layer: "Consultation Layer",
    description: "Structures assessment, treatment planning and recommendations.",
    connectsTo: ["patient-os", "clinic-os", "imaging-os", "surgery-os"],
    href: "/platform",
  },
  {
    id: "imaging-os",
    name: "ImagingOS",
    layer: "Imaging Layer",
    description: "Standardises clinical photography and image intelligence.",
    connectsTo: ["patient-os", "consultation-os", "surgery-os", "audit-os"],
    href: "/platform/imaging-os",
  },
  {
    id: "surgery-os",
    name: "SurgeryOS",
    layer: "Surgical Layer",
    description: "Tracks case planning, procedure day and post-op workflow.",
    connectsTo: ["consultation-os", "imaging-os", "patient-os", "audit-os"],
    href: "/platform/surgery-os",
  },
  {
    id: "audit-os",
    name: "AuditOS",
    layer: "Outcome Layer",
    description: "Measures outcomes and quality intelligence.",
    connectsTo: ["imaging-os", "surgery-os", "patient-os", "analytics-os", "academy-os"],
    href: "/hair-intelligence",
  },
  {
    id: "academy-os",
    name: "AcademyOS",
    layer: "Training Layer",
    description: "Connects training, certification and competencies.",
    connectsTo: ["audit-os", "clinic-os", "analytics-os"],
    href: "/methodology",
  },
  {
    id: "analytics-os",
    name: "AnalyticsOS",
    layer: "Analytics Layer",
    description: "Turns clinic data into operational intelligence.",
    connectsTo: ["leadflow", "clinic-os", "patient-os", "audit-os", "academy-os"],
    href: "/platform/analytics-os",
  },
];

const MODULE_BY_ID: Record<PlatformArchitectureModuleId, ModuleDef> = MODULES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<PlatformArchitectureModuleId, ModuleDef>,
);

const ENGINE_LABEL = "Follicle Intelligence Engine";

function polarToPercent(angleRad: number, radiusPercent: number) {
  const x = 50 + radiusPercent * Math.sin(angleRad);
  const y = 50 - radiusPercent * Math.cos(angleRad);
  return { x, y };
}

function useMinWidthXl() {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return matches;
}

function ModuleDetail({
  module,
  detailId,
  connectionsHeadingId,
}: {
  module: ModuleDef | null;
  detailId: string;
  connectionsHeadingId: string;
}) {
  if (!module) {
    return (
      <div
        id={detailId}
        className="rounded-[1.35rem] border border-border/70 bg-background/40 p-5 md:p-6"
        role="region"
        aria-label="Layer details"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Select a layer with the pointer, keyboard, or assistive technology to see how it connects across the
          operating system. Each module exchanges structured signal with the central {ENGINE_LABEL}.
        </p>
      </div>
    );
  }

  return (
    <div
      id={detailId}
      className="rounded-[1.35rem] border border-primary/25 bg-background/50 p-5 shadow-[0_12px_40px_rgb(1_5_12/35%)] md:p-6"
      role="region"
      aria-label={`${module.name} details`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/90">{module.layer}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{module.name}</h3>
        </div>
        <Link
          href={module.href}
          className="shrink-0 rounded-lg border border-border/70 bg-card/50 px-3 py-1.5 text-xs font-medium text-foreground underline decoration-primary/45 underline-offset-4 transition-colors hover:border-primary/35 hover:text-primary"
        >
          View layer
        </Link>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">{module.description}</p>
      <div className="mt-5 border-t border-border/50 pt-4">
        <p id={connectionsHeadingId} className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Connected modules
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-labelledby={connectionsHeadingId}>
          {module.connectsTo.map((cid) => {
            const target = MODULE_BY_ID[cid];
            return (
              <li key={cid}>
                <Link
                  href={target.href}
                  className="inline-flex rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {target.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function EngineCore({ className, engineDescId }: { className?: string; engineDescId: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/35 bg-gradient-to-b from-primary/15 to-background/60 px-4 py-4 text-center shadow-lg shadow-black/25 xl:px-3 xl:py-4",
        className,
      )}
      role="img"
      aria-label={`${ENGINE_LABEL}: scoring, benchmarks, governance rules, and longitudinal intelligence shared across every OS layer.`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/90">Central core</p>
      <p id={engineDescId} className="mt-1.5 text-base font-semibold leading-snug text-foreground xl:text-sm xl:leading-snug">
        {ENGINE_LABEL}
      </p>
      <p className="mx-auto mt-2 hidden text-xs leading-relaxed text-muted-foreground xl:block">
        Scoring, benchmarks, governance, and longitudinal intelligence—shared across every OS layer.
      </p>
    </div>
  );
}

export function PlatformArchitectureMap({ className }: { className?: string }) {
  const baseId = useId();
  const regionId = `${baseId}-region`;
  const detailId = `${baseId}-detail`;
  const connectionsHeadingId = `${baseId}-connections-heading`;
  const engineDescId = `${baseId}-engine-desc`;

  const isDesktopRadial = useMinWidthXl();

  const [hoverId, setHoverId] = useState<PlatformArchitectureModuleId | null>(null);
  const [pinnedId, setPinnedId] = useState<PlatformArchitectureModuleId | null>(null);
  const [focusId, setFocusId] = useState<PlatformArchitectureModuleId | null>(null);

  const activeId = hoverId ?? focusId ?? pinnedId;
  const activeModule = activeId ? MODULE_BY_ID[activeId] : null;

  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  buttonRefs.current.length = MODULES.length;

  const focusModuleAt = useCallback((index: number) => {
    const el = buttonRefs.current[index];
    if (el) {
      el.focus();
    }
  }, []);

  const handleModuleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const len = MODULES.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        focusModuleAt((index + 1) % len);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        focusModuleAt((index - 1 + len) % len);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusModuleAt(0);
      } else if (e.key === "End") {
        e.preventDefault();
        focusModuleAt(len - 1);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const id = MODULES[index].id;
        setPinnedId((prev) => (prev === id ? null : id));
      }
    },
    [focusModuleAt],
  );

  const angles = useMemo(() => MODULES.map((_, i) => (i / MODULES.length) * Math.PI * 2 - Math.PI / 2), []);
  const radius = 40;

  const moduleButtonClass = (isActive: boolean, isRadial: boolean) =>
    cn(
      "rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      isRadial ? "px-2.5 py-2 xl:w-[min(34%,150px)]" : "w-full px-3 py-3",
      isActive
        ? "border-primary/50 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
        : "border-border/70 bg-card/35 hover:border-primary/35 xl:bg-card/80",
    );

  const renderModuleButton = (m: ModuleDef, i: number, isRadial: boolean) => {
    const { x, y } = polarToPercent(angles[i], radius);
    const isActive = activeId === m.id;
    return (
      <button
        key={m.id}
        type="button"
        ref={(el) => {
          buttonRefs.current[i] = el;
        }}
        style={isRadial ? { left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" } : undefined}
        className={cn(moduleButtonClass(isActive, isRadial), isRadial && "absolute z-20")}
        aria-pressed={pinnedId === m.id}
        aria-describedby={detailId}
        onMouseEnter={() => setHoverId(m.id)}
        onMouseLeave={() => setHoverId(null)}
        onFocus={() => setFocusId(m.id)}
        onBlur={() => setFocusId(null)}
        onClick={() => setPinnedId((prev) => (prev === m.id ? null : m.id))}
        onKeyDown={(e) => handleModuleKeyDown(e, i)}
      >
        <span
          className={cn(
            "block font-semibold uppercase tracking-[0.18em] text-muted-foreground",
            isRadial ? "text-[9px] tracking-[0.16em]" : "text-[10px]",
          )}
        >
          {m.layer}
        </span>
        <span className={cn("mt-1 block font-semibold text-foreground", isRadial ? "text-xs sm:text-sm" : "text-sm")}>
          {m.name}
        </span>
      </button>
    );
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        id={regionId}
        className="fi-panel rounded-[1.35rem] p-4 sm:p-6 md:p-7"
        role="region"
        aria-label="Follicle Intelligence platform architecture"
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] xl:items-start xl:gap-10">
          {isDesktopRadial ? (
            <div className="relative mx-auto aspect-square w-full max-w-[min(100%,520px)]">
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden>
                {MODULES.map((m, i) => {
                  const { x, y } = polarToPercent(angles[i], radius);
                  const isLit =
                    activeId &&
                    (activeId === m.id ||
                      MODULE_BY_ID[activeId].connectsTo.includes(m.id) ||
                      m.connectsTo.includes(activeId));
                  return (
                    <line
                      key={`line-${m.id}`}
                      x1="50"
                      y1="50"
                      x2={x}
                      y2={y}
                      stroke={isLit ? "hsl(var(--primary) / 0.45)" : "hsl(var(--border) / 0.55)"}
                      strokeWidth={isLit ? 0.55 : 0.35}
                    />
                  );
                })}
              </svg>

              <EngineCore
                engineDescId={engineDescId}
                className="absolute left-1/2 top-1/2 z-10 w-[min(42%,200px)] -translate-x-1/2 -translate-y-1/2"
              />

              {MODULES.map((m, i) => renderModuleButton(m, i, true))}
            </div>
          ) : (
            <div>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULES.slice(0, 4).map((m, i) => renderModuleButton(m, i, false))}
              </div>
              <div className="my-4">
                <EngineCore engineDescId={engineDescId} className="mx-auto max-w-lg" />
                <p className="mx-auto mt-3 max-w-lg text-center text-xs leading-relaxed text-muted-foreground sm:text-sm xl:hidden">
                  Scoring, benchmarks, governance rules, and longitudinal intelligence—shared across every OS layer.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULES.slice(4).map((m, i) => renderModuleButton(m, i + 4, false))}
              </div>
            </div>
          )}

          <div className="min-w-0">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground xl:hidden">
              Layer details
            </p>
            <div aria-live="polite" aria-atomic="true" className="min-h-[180px] md:min-h-[200px]">
              <ModuleDetail module={activeModule} detailId={detailId} connectionsHeadingId={connectionsHeadingId} />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Tip: hover to preview; click or press Enter to pin selection. Arrow keys move focus between modules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
