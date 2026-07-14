"use client";

import Link from "next/link";

import {
  buildPatientDirectoryHref,
  type PatientDirectoryQuery,
} from "@/src/lib/patients/patientDirectoryQuery";
import { PATIENT_OS_LEGACY_SAVED_VIEWS } from "@/src/lib/patients/patientDirectoryFilters";
import { cn } from "@/lib/utils";

export function PatientOsLegacySavedViews({
  tenantId,
  query,
}: {
  tenantId: string;
  query: PatientDirectoryQuery;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved views</p>
      <div className="flex flex-wrap gap-2">
        {PATIENT_OS_LEGACY_SAVED_VIEWS.map((view) => {
          const active = query.savedView === view.id;
          const href = buildPatientDirectoryHref(
            tenantId,
            { ...query, ...view.query, page: 1 },
            { view: "list" }
          );
          return (
            <Link
              key={view.id}
              href={href}
              title={view.description}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
                active
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
