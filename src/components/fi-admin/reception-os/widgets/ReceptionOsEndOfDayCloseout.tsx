"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Moon } from "lucide-react";

import { cn } from "@/lib/utils";
import { closeReceptionOperatingDayAction } from "@/lib/actions/fi-reception-closeout-actions";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { ReceptionOsSeverityBadge } from "@/src/components/fi-admin/reception-os/receptionOsSeverityStyles";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { ReceptionCloseoutSnapshot } from "@/src/lib/receptionOs/receptionDailyCloseoutModel";

const ITEM_KIND_LABELS: Record<string, string> = {
  unresolved_critical_task: "Critical task",
  unresolved_blocked_task: "Blocked task",
  unpaid_deposit_due_today: "Deposit due today",
  incomplete_surgery_readiness: "Surgery readiness",
  consultation_no_next_action: "Consultation follow-up",
  communication_failed: "Failed communication",
  tomorrow_first_patient_readiness: "Tomorrow first patient",
};

export function ReceptionOsEndOfDayCloseoutWidget({
  tenantId,
  closeout,
  onClosed,
}: {
  tenantId: string;
  closeout: ReceptionCloseoutSnapshot;
  onClosed?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(closeout.existingCloseoutNotes ?? "");
  const [error, setError] = useState<string | null>(null);

  const unresolvedRisks = closeout.checklist.filter(
    (item) => item.severity === "critical" || item.severity === "blocked" || item.itemKind === "communication_failed",
  );

  const runCloseDay = () => {
    setError(null);
    startTransition(async () => {
      const res = await closeReceptionOperatingDayAction(tenantId, { notes: notes.trim() || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClosed?.();
    });
  };

  return (
    <DashboardCard className="overflow-hidden border-violet-500/20">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-start gap-2">
          <Moon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />
          <SectionHeader
            title="End-of-day closeout"
            description={`Operating date ${closeout.operatingDate} · ${closeout.riskSummary}`}
          />
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Closeout checklist</p>
          {closeout.checklist.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">No open closeout items — day looks clear.</p>
          ) : (
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
              {closeout.checklist.map((item) => (
                <li
                  key={`${item.itemKind}-${item.sourceRefId ?? item.title}`}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-500">
                      {ITEM_KIND_LABELS[item.itemKind] ?? item.itemKind}
                    </span>
                    {item.severity ? <ReceptionOsSeverityBadge severity={item.severity} /> : null}
                  </div>
                  {item.href ? (
                    <Link href={item.href} className="mt-1 block text-sm font-medium text-cyan-200 hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-slate-100">{item.title}</p>
                  )}
                  {item.detail ? <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Unresolved risks</p>
            {unresolvedRisks.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-300/90">No critical or blocked risks flagged.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {unresolvedRisks.slice(0, 6).map((item) => (
                  <li key={`risk-${item.sourceRefId ?? item.title}`}>• {item.title}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Failed communications today</p>
            {closeout.failedCommunications.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No failed outbound messages recorded today.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {closeout.failedCommunications.map((f) => (
                  <li key={f.id} className="rounded border border-rose-500/20 bg-rose-500/[0.05] px-3 py-2 text-sm">
                    <p className="font-medium text-rose-100">
                      {f.channel.toUpperCase()} · {f.templateKey ?? "message"}
                    </p>
                    <p className="text-xs text-rose-200/80">{f.errorMessage ?? "Delivery failed"}</p>
                    {f.toAddress ? <p className="text-xs text-slate-500">{f.toAddress}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <label htmlFor="closeout-notes" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Closeout notes
            </label>
            <textarea
              id="closeout-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={Boolean(closeout.existingCloseoutId) || pending}
              rows={4}
              placeholder="Handover notes for tomorrow's team…"
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "mt-2 w-full resize-y px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600",
              )}
            />
          </section>

          {closeout.existingCloseoutId ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-100">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Day closed{closeout.closedAt ? ` at ${new Date(closeout.closedAt).toLocaleTimeString()}` : ""}.
            </div>
          ) : closeout.canCloseDay ? (
            <button
              type="button"
              onClick={() => runCloseDay()}
              disabled={pending}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-violet-100 disabled:opacity-60",
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Close day
            </button>
          ) : (
            <p className="text-xs text-slate-500">Only clinic managers and admins can close the operating day.</p>
          )}

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </div>
      </div>
    </DashboardCard>
  );
}
