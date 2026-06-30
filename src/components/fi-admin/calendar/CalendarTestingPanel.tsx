"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardCheck, FlaskConical, RefreshCw } from "lucide-react";

import { runCalendarConsultationSmokeTestAction, runCalendarUatSeedAction } from "@/lib/actions/fi-calendar-testing-actions";
import { CalendarReminderTestingSection } from "@/src/components/fi-admin/calendar/CalendarReminderTestingSection";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type { CalendarQaRow, CalendarQaStatus, CalendarTestingPagePayload } from "@/src/lib/calendar/calendarTestingTypes";

import { cn } from "@/lib/utils";

const LS_PREFIX = "fi-calendar-uat-checklist-v2::";

function lsKey(tenantId: string): string {
  return `${LS_PREFIX}${tenantId.trim()}`;
}

function readManual(tenantId: string): Record<string, CalendarQaStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(lsKey(tenantId));
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, CalendarQaStatus> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === "ready" || v === "warning" || v === "failed" || v === "not_tested") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeManual(tenantId: string, next: Record<string, CalendarQaStatus>): void {
  try {
    window.localStorage.setItem(lsKey(tenantId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function statusTone(s: CalendarQaStatus): "success" | "warning" | "danger" | "neutral" {
  if (s === "ready") return "success";
  if (s === "warning") return "warning";
  if (s === "failed") return "danger";
  return "neutral";
}

function statusLabel(s: CalendarQaStatus): string {
  if (s === "ready") return "Ready";
  if (s === "warning") return "Warning";
  if (s === "failed") return "Failed";
  return "Not tested";
}

function QaRowView({
  row,
  effectiveStatus,
  children,
}: {
  row: CalendarQaRow;
  effectiveStatus: CalendarQaStatus;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.08] py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-100">{row.title}</p>
          <FiStatusBadge tone={statusTone(effectiveStatus)} appearance="pill" density="compact">
            {statusLabel(effectiveStatus)}
          </FiStatusBadge>
        </div>
        {row.description ? <p className="text-xs text-slate-500">{row.description}</p> : null}
        {row.detail ? <p className="text-sm leading-relaxed text-slate-400">{row.detail}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">{children}</div> : null}
    </div>
  );
}

export function CalendarTestingPanel({
  tenantId,
  payload,
  showCrmNav,
  uatSeedEnabled = false,
}: {
  tenantId: string;
  payload: CalendarTestingPagePayload;
  showCrmNav: boolean;
  /** Server flag: development or `FI_ALLOW_CALENDAR_UAT_SEED` — shows optional demo seed controls. */
  uatSeedEnabled?: boolean;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const [manual, setManual] = useState<Record<string, CalendarQaStatus>>({});
  const [smokeBusy, setSmokeBusy] = useState(false);
  const [smokeMessage, setSmokeMessage] = useState<string | null>(null);
  const [smokeOk, setSmokeOk] = useState<boolean | null>(null);
  const [seedAdminKey, setSeedAdminKey] = useState("");
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedLines, setSeedLines] = useState<string[] | null>(null);
  const [seedOk, setSeedOk] = useState<boolean | null>(null);

  useEffect(() => {
    setManual(readManual(tid));
  }, [tid]);

  const setWorkflowStatus = useCallback(
    (id: string, status: CalendarQaStatus) => {
      setManual((prev) => {
        const next = { ...prev, [id]: status };
        writeManual(tid, next);
        return next;
      });
    },
    [tid]
  );

  const clearManual = useCallback(() => {
    setManual({});
    try {
      window.localStorage.removeItem(lsKey(tid));
    } catch {
      /* ignore */
    }
  }, [tid]);

  const sections = useMemo(() => payload.sections, [payload.sections]);

  const effectiveStatusFor = (sectionId: string, row: CalendarQaRow): CalendarQaStatus => {
    if (sectionId === "workflow") {
      return manual[row.id] ?? row.status;
    }
    if (row.id === "probe_valid_create" && smokeOk === true) return "ready";
    if (row.id === "probe_valid_create" && smokeOk === false) return "failed";
    return row.status;
  };

  const onUatSeed = async () => {
    setSeedBusy(true);
    setSeedLines(null);
    setSeedOk(null);
    try {
      const r = await runCalendarUatSeedAction(tid, { adminKey: seedAdminKey.trim() || null });
      if (r.ok) {
        setSeedOk(true);
        setSeedLines(r.lines);
      } else {
        setSeedOk(false);
        setSeedLines([r.error]);
      }
    } catch (e) {
      setSeedOk(false);
      setSeedLines([e instanceof Error ? e.message : String(e)]);
    } finally {
      setSeedBusy(false);
    }
  };

  const onSmokeTest = async () => {
    setSmokeBusy(true);
    setSmokeMessage(null);
    setSmokeOk(null);
    try {
      const r = await runCalendarConsultationSmokeTestAction(tid, {});
      if (r.ok) {
        setSmokeOk(true);
        setSmokeMessage(r.message);
      } else {
        setSmokeOk(false);
        setSmokeMessage(r.error);
      }
    } catch (e) {
      setSmokeOk(false);
      setSmokeMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSmokeBusy(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <FiPageHeader
        eyebrow="ClinicOS"
        title="Calendar UAT"
        description="Clinic calendar readiness for real testing: staff and service checks, automated guard probes, manual workflow sign-off, and optional demo seed data. Automated probes use the same server validation paths as production."
        titleId="calendar-uat-heading"
        primaryAction={
          <Link
            href={`${base}/calendar`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            Open calendar
          </Link>
        }
        secondaryAction={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg shadow-black/40 transition hover:border-slate-700 hover:bg-white/[0.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh probes
            </button>
            <Link
              href={`${base}/appointments`}
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg shadow-black/40 transition hover:border-slate-700 hover:bg-white/[0.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Appointments
            </Link>
            <Link
              href={`${base}/staff`}
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg shadow-black/40 transition hover:border-slate-700 hover:bg-white/[0.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Staff
            </Link>
            <Link
              href={`${base}/services`}
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg shadow-black/40 transition hover:border-slate-700 hover:bg-white/[0.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Services
            </Link>
            {showCrmNav ? (
              <Link
                href={`${base}/crm`}
                className="inline-flex items-center justify-center rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-lg shadow-black/40 transition hover:border-slate-700 hover:bg-white/[0.03] focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                CRM
              </Link>
            ) : null}
          </div>
        }
      />

      <FiCard className="border-cyan-400/30 bg-cyan-500/10">
        <div className="flex gap-2">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
          <div className="min-w-0 text-sm text-cyan-200">
            <p className="font-semibold text-cyan-200">Internal UAT only</p>
            <p className="mt-1 leading-relaxed text-cyan-200">
              The consultation smoke test creates a real booking and immediately cancels it (audit trail may still list the event). Manual checklist progress is stored in{" "}
              <code className="rounded bg-white/80 px-1 font-mono text-xs">localStorage</code> for this browser — not synced to the server. Public booking, SMS, and payments are out of scope here.
            </p>
            <button
              type="button"
              onClick={clearManual}
              className="mt-2 text-xs font-semibold text-cyan-200 underline decoration-sky-400/80 underline-offset-2 hover:text-cyan-200"
            >
              Clear saved manual checklist
            </button>
          </div>
        </div>
      </FiCard>

      {uatSeedEnabled ? (
        <FiCard className="border-amber-400/20 bg-amber-400/10">
          <h2 className="text-base font-semibold text-amber-200">Optional demo seed (dev / staging)</h2>
          <p className="mt-1 text-sm text-amber-200">
            Creates up to three schedulable staff rows, three catalog services (consultation / PRP / surgery), and sample
            bookings when a CRM lead with <code className="font-mono text-xs">person_id</code> and at least one clinic exist.
            Requires tenant <strong>admin</strong> or <strong>fi_admin</strong>, or a valid <code className="font-mono text-xs">FI_ADMIN_API_KEY</code> in the field below. Idempotent for matching staff names and UAT-titled bookings.
          </p>
          <label className="mt-3 block text-xs font-medium text-amber-200">
            FI Admin API key (optional)
            <input
              type="password"
              autoComplete="off"
              className="mt-1 w-full max-w-md rounded border border-amber-400/20 bg-[#0F1629]/80 backdrop-blur-md px-2 py-1.5 text-sm font-mono"
              value={seedAdminKey}
              onChange={(e) => setSeedAdminKey(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={seedBusy}
              onClick={onUatSeed}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
                seedBusy ? "cursor-not-allowed bg-white/[0.08] text-slate-500" : "bg-amber-700 text-white hover:bg-amber-800"
              )}
            >
              {seedBusy ? "Seeding…" : "Run UAT seed"}
            </button>
          </div>
          {seedLines?.length ? (
            <ul className={cn("mt-3 list-inside list-disc space-y-1 text-sm", seedOk ? "text-emerald-300" : "text-rose-300")}>
              {seedLines.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          ) : null}
        </FiCard>
      ) : null}

      {sections.map((section) => (
        <FiCard key={section.id}>
          <div className="flex items-start gap-2 border-b border-white/[0.08] pb-3">
            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-slate-100">{section.title}</h2>
              {section.description ? <p className="mt-1 text-sm text-slate-400">{section.description}</p> : null}
            </div>
          </div>
          <div className="mt-1 divide-y divide-white/[0.06]">
            {section.rows.map((r) => {
              const eff = effectiveStatusFor(section.id, r);
              const isSmoke = r.id === "probe_valid_create";
              const isWorkflow = section.id === "workflow";
              return (
                <QaRowView key={r.id} row={r} effectiveStatus={eff}>
                  {isSmoke ? (
                    <button
                      type="button"
                      disabled={smokeBusy}
                      onClick={onSmokeTest}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
                        smokeBusy ? "cursor-not-allowed bg-white/[0.08] text-slate-500" : "bg-sky-600 text-white hover:bg-sky-700"
                      )}
                    >
                      {smokeBusy ? "Running…" : "Run smoke test"}
                    </button>
                  ) : null}
                  {isWorkflow ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setWorkflowStatus(r.id, "ready")}
                        className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15"
                      >
                        Mark ready
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkflowStatus(r.id, "warning")}
                        className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/15"
                      >
                        Warning
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkflowStatus(r.id, "failed")}
                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/15"
                      >
                        Failed
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkflowStatus(r.id, "not_tested")}
                        className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/[0.03]"
                      >
                        Reset
                      </button>
                    </>
                  ) : null}
                </QaRowView>
              );
            })}
          </div>
          {section.id === "validation" && smokeMessage ? (
            <p className={cn("mt-3 text-sm", smokeOk ? "text-emerald-300" : "text-rose-300")} role="status">
              {smokeMessage}
            </p>
          ) : null}
        </FiCard>
      ))}

      <CalendarReminderTestingSection tenantId={tid} reminders={payload.reminders} />
    </div>
  );
}
