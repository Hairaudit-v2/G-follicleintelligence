"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { ReceptionOsCommunicationActionBar } from "@/src/components/fi-admin/reception-os/ReceptionOsCommunicationActionBar";
import {
  ReceptionOsRecordLinks,
  receptionOsPrimaryHref,
} from "@/src/components/fi-admin/reception-os/ReceptionOsRecordLinks";
import { buildContextFromDeposit } from "@/src/components/fi-admin/reception-os/receptionOsCommunicationContext";
import {
  ReceptionOsSeverityBadge,
  receptionOsSeverityRowClass,
} from "@/src/components/fi-admin/reception-os/receptionOsSeverityStyles";
import type { ReceptionOsDepositItem } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

export function ReceptionOsOutstandingDepositsWidget({
  tenantId,
  tenantName,
  deposits,
  onMutated,
}: {
  tenantId: string;
  tenantName: string;
  deposits: ReceptionOsDepositItem[];
  onMutated?: () => void;
}) {
  const overdueCount = deposits.filter((d) => d.isOverdue).length;

  return (
    <DashboardCard className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Outstanding deposits"
          description={
            overdueCount > 0
              ? `${overdueCount} overdue · ${deposits.length} total unpaid`
              : `${deposits.length} awaiting collection`
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {deposits.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">No outstanding deposits.</p>
        ) : (
          <ul className="space-y-1">
            {deposits.map((d) => {
              const primaryHref = receptionOsPrimaryHref(d.hrefs);
              return (
                <li key={d.id}>
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2.5",
                      receptionOsSeverityRowClass(d.severity)
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="min-w-0 flex-1">
                        {primaryHref ? (
                          <Link
                            href={primaryHref}
                            className="truncate font-medium text-slate-100 hover:underline"
                          >
                            {d.patientLabel}
                          </Link>
                        ) : (
                          <p className="truncate font-medium text-slate-100">{d.patientLabel}</p>
                        )}
                        <p className="text-xs capitalize text-slate-500">
                          {d.context.replace(/_/g, " ")}
                        </p>
                      </div>
                      <ReceptionOsSeverityBadge severity={d.severity} />
                      <div className="text-right">
                        <p className="font-mono text-sm tabular-nums text-slate-200">
                          {d.currency} {d.amountPaid.toFixed(0)} / {d.amountExpected.toFixed(0)}
                        </p>
                        {d.dueDate ? (
                          <p
                            className={cn(
                              "text-xs",
                              d.isOverdue ? "font-semibold text-rose-400" : "text-slate-500"
                            )}
                          >
                            {d.isOverdue ? (
                              <span className="inline-flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" aria-hidden />
                                Due {d.dueDate}
                              </span>
                            ) : (
                              `Due ${d.dueDate}`
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <ReceptionOsRecordLinks hrefs={d.hrefs} className="mt-1.5" />
                    <ReceptionOsCommunicationActionBar
                      tenantId={tenantId}
                      clinicName={tenantName}
                      context={buildContextFromDeposit(d, tenantName)}
                      showPaymentLink
                      paymentRecordId={d.id}
                      onMutated={onMutated}
                      className="mt-2"
                    />
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
