import Link from "next/link";
import { AlertCircle, Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import {
  ReceptionOsRecordLinks,
  receptionOsPrimaryHref,
} from "@/src/components/fi-admin/reception-os/ReceptionOsRecordLinks";
import {
  ReceptionOsSeverityBadge,
  RECEPTION_OS_SEVERITY_SURFACE,
} from "@/src/components/fi-admin/reception-os/receptionOsSeverityStyles";
import { RECEPTION_OS_ALERT_LABELS } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

export function ReceptionOsActionAlertsWidget({ alerts }: { alerts: ReceptionOsActionAlert[] }) {
  const criticalCount = alerts.filter(
    (a) => a.severity === "critical" || a.severity === "blocked"
  ).length;

  return (
    <DashboardCard className="flex h-full min-h-[280px] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionHeader
          title="Action required"
          description={
            criticalCount > 0
              ? `${criticalCount} critical · ${alerts.length} total`
              : `${alerts.length} items`
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Bell className="mb-2 h-8 w-8 text-emerald-500/50" aria-hidden />
            <p className="text-sm text-slate-400">All clear — no action items right now.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a) => {
              const styles = RECEPTION_OS_SEVERITY_SURFACE[a.severity];
              const primaryHref = a.href ?? receptionOsPrimaryHref(a.hrefs ?? {});
              const inner = (
                <div
                  className={cn(
                    "flex gap-3 rounded-lg border px-3 py-2.5",
                    styles.border,
                    styles.bg
                  )}
                >
                  <AlertCircle className={cn("mt-0.5 h-4 w-4 shrink-0", styles.text)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {RECEPTION_OS_ALERT_LABELS[a.kind]}
                      </p>
                      <ReceptionOsSeverityBadge severity={a.severity} />
                    </div>
                    <p className="font-medium text-slate-100">{a.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">{a.detail}</p>
                    {a.hrefs ? <ReceptionOsRecordLinks hrefs={a.hrefs} className="mt-1.5" /> : null}
                  </div>
                </div>
              );
              return (
                <li key={a.id}>
                  {primaryHref ? (
                    <Link href={primaryHref} className="block transition hover:opacity-95">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
