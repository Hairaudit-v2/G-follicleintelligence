import Link from "next/link";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import {
  ReceptionOsRecordLinks,
  receptionOsPrimaryHref,
} from "@/src/components/fi-admin/reception-os/ReceptionOsRecordLinks";
import type { ReceptionOsTodaysPatient } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  const s = status.trim().toLowerCase();
  if (s === "arrived" || s === "completed") return "success";
  if (s === "no_show" || s === "cancelled") return "danger";
  if (s === "confirmed") return "info";
  return "neutral";
}

export function ReceptionOsTodaysPatientsWidget({
  patients,
}: {
  patients: ReceptionOsTodaysPatient[];
}) {
  return (
    <DashboardCard className="flex h-full min-h-[320px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Today's patients"
          description={`${patients.length} appointment${patients.length === 1 ? "" : "s"}`}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {patients.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            No appointments scheduled for today.
          </p>
        ) : (
          <ul className="space-y-1">
            {patients.map((p) => {
              const primaryHref = receptionOsPrimaryHref(p.hrefs) ?? p.hrefs.appointment;
              return (
                <li key={p.id}>
                  <Link
                    href={primaryHref}
                    className={cn(
                      "block rounded-lg border border-transparent px-3 py-2.5 transition",
                      "hover:border-cyan-500/20 hover:bg-cyan-500/[0.04]"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-[3.5rem] font-mono text-sm tabular-nums text-cyan-300/90">
                        {p.appointmentTime || "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
                        {p.patientName}
                      </span>
                      <span className="hidden text-xs text-slate-500 sm:inline">
                        {p.appointmentType}
                      </span>
                      <FiStatusBadge tone={statusTone(p.status)}>{p.statusLabel}</FiStatusBadge>
                      <span className="w-full truncate text-xs text-slate-500 sm:w-auto sm:max-w-[8rem]">
                        {p.clinician}
                      </span>
                    </div>
                    <ReceptionOsRecordLinks hrefs={p.hrefs} className="mt-1.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
