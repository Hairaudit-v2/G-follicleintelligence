"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { PilotBlockerBadge } from "@/src/components/pilotControl/PilotBlockerBadge";
import { PilotReadinessBadge } from "@/src/components/pilotControl/PilotReadinessBadge";
import { PilotPermissionLimitedNotice } from "@/src/components/pilotControl/PilotPartialState";
import type { PilotPatientControlDetail } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlRoleKey } from "@/src/lib/pilotControl/pilotControlContracts";
import { formatAgeSeconds, formatDateTime } from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import {
  canShowClinicalSummary,
  canShowFinancialSummary,
  canShowPauseRecommendation,
  canShowTechnicalSummary,
  shouldSuppressPatientSafeSummary,
} from "@/src/lib/pilotControl/ui/pilotControlUiAccess";
import { PilotControlClientError } from "@/src/lib/pilotControl/ui/pilotControlClient";

function SummaryBlock({
  title,
  data,
}: {
  title: string;
  data: unknown;
}) {
  if (data == null) return null;
  if (typeof data !== "object") {
    return (
      <div>
        <h3 className="text-xs font-semibold text-slate-300">{title}</h3>
        <p className="mt-1 text-sm text-slate-200">{String(data)}</p>
      </div>
    );
  }
  const entries = Object.entries(data as Record<string, unknown>).filter(
    ([, v]) => v != null && typeof v !== "object"
  );
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-300">{title}</h3>
      <dl className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-200">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function PilotPatientDetailDrawer({
  open,
  onClose,
  detail,
  loading,
  error,
  role,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  detail: PilotPatientControlDetail | null;
  loading?: boolean;
  error?: Error | null;
  role: PilotControlRoleKey;
  onRefresh?: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const showClinical = canShowClinicalSummary(role);
  const showFinancial = canShowFinancialSummary(role);
  const showTechnical = canShowTechnicalSummary(role);
  const showPause = canShowPauseRecommendation(role);
  const corr =
    error instanceof PilotControlClientError ? error.correlationId : undefined;

  const blockers = Array.isArray(detail?.blockers)
    ? (detail!.blockers as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close patient detail"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilot-patient-drawer-title"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#0B1220] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="pilot-patient-drawer-title" className="text-sm font-semibold text-[#F8FAFC]">
            Patient detail
          </h2>
          <div className="flex gap-2">
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Refresh
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
          {loading && !detail ? (
            <p className="text-slate-400">Loading patient detail…</p>
          ) : null}
          {error ? (
            <p className="text-rose-200" role="alert">
              {error.message}
              {corr ? ` (Correlation: ${corr})` : ""}
            </p>
          ) : null}
          {detail ? (
            <>
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/85">
                  Identity and enrolment
                </h3>
                <p className="text-base font-medium text-slate-50">
                  {detail.identity.displayName}
                </p>
                <p className="text-xs text-slate-400">
                  Canonical ID: {detail.identity.patientId}
                  {detail.identity.reference ? ` · ${detail.identity.reference}` : ""}
                </p>
                <p className="text-xs text-slate-300">
                  Enrolment: {detail.enrolment.status} · Evaluated{" "}
                  {formatDateTime(detail.evaluatedAt)}
                </p>
                {showTechnical && detail.identity.identityIntegrityOk === false ? (
                  <p className="text-xs text-rose-200">Identity integrity requires review.</p>
                ) : null}
              </section>

              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/85">
                  Journey
                </h3>
                <p className="text-slate-200">
                  {detail.journey.milestoneLabel || detail.journey.milestone}
                </p>
                <p className="text-xs text-slate-400">
                  Next patient: {detail.actions.patient[0]?.label ?? "—"} · Next clinic:{" "}
                  {detail.actions.clinic[0]?.label ?? "—"}
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/85">
                  Readiness
                </h3>
                <div className="flex flex-wrap gap-2">
                  <PilotReadinessBadge value={detail.readiness.overall?.state} />
                  <span className="text-xs text-slate-400">Clinical:</span>
                  <PilotReadinessBadge value={detail.readiness.clinical?.state} />
                  <span className="text-xs text-slate-400">Financial:</span>
                  <PilotReadinessBadge value={detail.readiness.financial?.state} />
                  <span className="text-xs text-slate-400">Patient:</span>
                  <PilotReadinessBadge value={detail.readiness.patient?.state} />
                  <span className="text-xs text-slate-400">Operational:</span>
                  <PilotReadinessBadge value={detail.readiness.operational?.state} />
                  <span className="text-xs text-slate-400">Technical:</span>
                  <PilotReadinessBadge value={detail.readiness.technical?.state} />
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/85">
                  Active blockers
                </h3>
                {blockers.length === 0 ? (
                  <p className="text-xs text-slate-400">No active blockers in this evaluation.</p>
                ) : (
                  <ul className="space-y-2">
                    {blockers.map((b, i) => {
                      const severity = String(b.severity ?? "");
                      const category = String(b.category ?? "");
                      const pause =
                        showPause &&
                        Boolean(
                          (b.escalation as { requiresPilotPause?: boolean } | undefined)
                            ?.requiresPilotPause
                        );
                      const safe = b.patientSafeSummary;
                      return (
                        <li
                          key={String(b.id ?? b.blockerKey ?? i)}
                          className="rounded-lg border border-white/10 p-2"
                        >
                          <PilotBlockerBadge severity={severity} pause={pause} />
                          <p className="mt-1 text-slate-100">{String(b.title ?? "")}</p>
                          <p className="text-xs text-slate-400">
                            Owner:{" "}
                            {String(
                              (b.ownership as { ownerType?: string } | undefined)?.ownerType ??
                                "—"
                            )}{" "}
                            · Age: {formatAgeSeconds(Number(b.ageSeconds ?? 0))}
                          </p>
                          <p className="text-xs text-cyan-100/90">
                            Next: {String(b.recommendedNextAction ?? "—")}
                          </p>
                          {typeof safe === "string" &&
                          !shouldSuppressPatientSafeSummary(category) ? (
                            <p className="text-xs text-slate-500">{safe}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {showClinical ? (
                <SummaryBlock title="Clinical summary" data={detail.clinical} />
              ) : (
                <PilotPermissionLimitedNotice />
              )}
              {showFinancial ? (
                <SummaryBlock title="Financial summary" data={detail.financial} />
              ) : null}
              <SummaryBlock title="Documents and consent" data={detail.documents ?? detail.consent} />
              <SummaryBlock title="Communications and app" data={detail.communication ?? detail.app} />
              {showTechnical ? (
                <SummaryBlock title="Technical health" data={detail.technical} />
              ) : null}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/85">
                  Canonical source links
                </h3>
                <ul className="mt-2 space-y-1 text-xs">
                  {detail.sourceLinks.map((link) => (
                    <li key={`${link.module}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="text-cyan-300 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="text-[11px] text-slate-500">
                Read-only view. No acknowledge, resolve, invite, message, or payment controls.
              </p>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
