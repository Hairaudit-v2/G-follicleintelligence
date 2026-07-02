"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";
import {
  resolveStaffLifecycleOperationalState,
  STAFF_LIFECYCLE_OPERATIONAL_STATES,
} from "@/src/lib/workforce-os/staffLifecyclePresentation";

export function StaffLifecyclePanel({
  lifecycle,
}: {
  lifecycle: Pick<StaffMemberLifecycleRow, "employment_status" | "archived_at">;
}) {
  const currentState = resolveStaffLifecycleOperationalState(lifecycle);

  return (
    <DashboardCard className="p-6">
      <h2 className="text-lg font-semibold text-[#F8FAFC]">Staff lifecycle</h2>
      <p className="mt-1 text-sm text-[#94A3B8]">
        One operational view of where this person sits in your workforce.
      </p>
      <ul className="mt-5 space-y-3">
        {STAFF_LIFECYCLE_OPERATIONAL_STATES.map((state) => {
          const isCurrent = state.id === currentState;
          return (
            <li
              key={state.id}
              className={`rounded-xl border px-4 py-3 ${
                isCurrent
                  ? "border-[#22C1FF]/40 bg-[#22C1FF]/10"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-start gap-3">
                {isCurrent ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#22C1FF]"
                    aria-hidden
                  />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#475569]" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        isCurrent ? "text-[#F8FAFC]" : "text-[#CBD5E1]"
                      }`}
                    >
                      {state.label}
                    </p>
                    {isCurrent ? (
                      <span className="rounded-full border border-[#22C1FF]/30 bg-[#22C1FF]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7DD3FC]">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[#94A3B8]">{state.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}
