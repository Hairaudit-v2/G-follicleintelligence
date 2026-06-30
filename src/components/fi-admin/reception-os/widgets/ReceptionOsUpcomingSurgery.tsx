"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { ReceptionOsCommunicationActionBar } from "@/src/components/fi-admin/reception-os/ReceptionOsCommunicationActionBar";
import {
  ReceptionOsRecordLinks,
  receptionOsPrimaryHref,
} from "@/src/components/fi-admin/reception-os/ReceptionOsRecordLinks";
import { buildContextFromSurgery } from "@/src/components/fi-admin/reception-os/receptionOsCommunicationContext";
import {
  ReceptionOsSeverityBadge,
  receptionOsSeverityRowClass,
} from "@/src/components/fi-admin/reception-os/receptionOsSeverityStyles";
import type { ReceptionOsSurgeryItem } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

function ReadinessPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide",
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
      )}
    >
      {ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}

export function ReceptionOsUpcomingSurgeryWidget({
  tenantId,
  tenantName,
  surgeries,
  onMutated,
}: {
  tenantId: string;
  tenantName: string;
  surgeries: ReceptionOsSurgeryItem[];
  onMutated?: () => void;
}) {
  return (
    <DashboardCard className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader title="Upcoming surgery" description="Next 14 days · readiness snapshot" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {surgeries.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">
            No surgeries scheduled in the next 14 days.
          </p>
        ) : (
          <ul className="space-y-1">
            {surgeries.map((s) => {
              const primaryHref = receptionOsPrimaryHref(s.hrefs);
              return (
                <li key={s.bookingId}>
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2.5",
                      receptionOsSeverityRowClass(s.severity)
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {primaryHref ? (
                          <Link
                            href={primaryHref}
                            className="truncate font-medium text-slate-100 hover:underline"
                          >
                            {s.patientLabel}
                          </Link>
                        ) : (
                          <p className="truncate font-medium text-slate-100">{s.patientLabel}</p>
                        )}
                        <p className="text-xs text-slate-500">
                          {s.surgeryDate} · {s.surgeryTime || "—"}
                          <span className="text-slate-600"> · </span>
                          {s.daysUntil === 0
                            ? "Today"
                            : s.daysUntil === 1
                              ? "Tomorrow"
                              : `${s.daysUntil} days`}
                        </p>
                        {s.staffAssigned ? (
                          <p className="mt-0.5 text-xs text-slate-500">Staff: {s.staffAssigned}</p>
                        ) : null}
                      </div>
                      <ReceptionOsSeverityBadge severity={s.severity} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ReadinessPill ok={s.paymentComplete} label="Payment" />
                      <ReadinessPill ok={s.consentComplete} label="Consent" />
                      <span className="text-[0.62rem] text-slate-500">{s.readinessStatus}</span>
                      {s.readinessPercent != null ? (
                        <span className="text-[0.62rem] text-slate-500">
                          {s.readinessPercent}% ready
                        </span>
                      ) : null}
                    </div>
                    <ReceptionOsRecordLinks hrefs={s.hrefs} className="mt-1.5" />
                    {!s.paymentComplete ? (
                      <ReceptionOsCommunicationActionBar
                        tenantId={tenantId}
                        clinicName={tenantName}
                        context={buildContextFromSurgery(s, tenantName)}
                        showPaymentLink
                        onMutated={onMutated}
                        className="mt-2"
                      />
                    ) : (
                      <ReceptionOsCommunicationActionBar
                        tenantId={tenantId}
                        clinicName={tenantName}
                        context={buildContextFromSurgery(s, tenantName)}
                        onMutated={onMutated}
                        className="mt-2"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
