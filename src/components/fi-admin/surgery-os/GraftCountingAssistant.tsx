"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  RefreshCw,
  Scissors,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  addExtractionGraftCountAction,
  addImplantationGraftCountAction,
  confirmTrayGraftCountAction,
  correctGraftCountAction,
  enterTrayGraftCountAction,
  reconcileGraftsAction,
} from "@/lib/actions/fi-surgery-os-actions";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { useSurgeryOsRefresh } from "@/src/components/fi-admin/surgery-os/useSurgeryOsRefresh";
import { useGraftCountDevice } from "@/src/components/fi-admin/surgery-os/useGraftCountDevice";
import type { SurgeryOsCommandCentrePayload } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";
import type { SurgeryOsAlert, SurgeryOsGraftCountEvent, SurgeryOsGraftSummary } from "@/src/lib/surgeryOs/surgeryOsBoardModel.types";
import type { SurgeryOsGraftCountSessionLock } from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import type { GraftSaveState } from "@/src/components/fi-admin/surgery-os/useGraftCountDevice";
import {
  buildGraftSummaryExport,
  computeGraftCompositionTotal,
  computeGraftCorrectionMagnitude,
  computeTrayHairTotal,
  requiresLargeCorrectionNote,
  resolveGraftCountSessionLock,
  SURGERY_OS_GRAFT_LARGE_CORRECTION_THRESHOLD,
  SURGERY_OS_GRAFT_TYPE_LABELS,
  type SurgeryOsGraftType,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import {
  resolveSurgeryOsStaffRoleCategory,
  surgeryOsGraftActionAllowed,
} from "@/src/lib/surgeryOs/surgeryOsPolicy";

type CountingMode = "quick_tap" | "tray" | "batch" | "manual" | "correction";
type CountPhase = "extraction" | "implantation";

const MODES: Array<{ id: CountingMode; label: string; hint: string }> = [
  { id: "quick_tap", label: "Quick tap", hint: "Large tap targets for fast theatre counting" },
  { id: "tray", label: "Tray", hint: "Full tray composition entry" },
  { id: "batch", label: "Batch", hint: "Enter multiple graft types at once" },
  { id: "manual", label: "Manual", hint: "Voice-friendly numeric entry" },
  { id: "correction", label: "Correction", hint: "Surgeon / manager authoritative fix" },
];

const QUICK_TAP_BUTTONS: Array<{ label: string; graftType: SurgeryOsGraftType; count: number }> = [
  { label: "+1 Single", graftType: "single", count: 1 },
  { label: "+1 Double", graftType: "double", count: 1 },
  { label: "+1 Triple", graftType: "triple", count: 1 },
  { label: "+1 Multiple", graftType: "multiple", count: 1 },
  { label: "+10 Singles", graftType: "single", count: 10 },
  { label: "+10 Doubles", graftType: "double", count: 10 },
  { label: "+10 Triples", graftType: "triple", count: 10 },
  { label: "+10 Multiples", graftType: "multiple", count: 10 },
];

const tapButtonClass =
  "min-h-[4.5rem] rounded-2xl border border-violet-400/25 bg-violet-950/40 px-4 py-4 text-base font-bold text-violet-50 shadow-lg shadow-violet-950/30 transition active:scale-[0.97] active:bg-violet-800/50 disabled:opacity-50 touch-manipulation select-none";

const fieldClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-lg text-slate-100 tabular-nums";

export function GraftCountingAssistant({
  data: initialData,
  initialSurgeryId = null,
}: {
  data: SurgeryOsCommandCentrePayload;
  initialSurgeryId?: string | null;
}) {
  const { data, isRefreshing, refreshError, refresh } = useSurgeryOsRefresh({
    tenantId: initialData.tenantId,
    initialData,
  });
  const { deviceId, saveState, runGuarded, isSubmitting } = useGraftCountDevice();

  const staffCategory = resolveSurgeryOsStaffRoleCategory(data.viewer.staffRole);
  const isAdmin = data.viewer.role === "admin" || data.viewer.role === "theatre_manager";
  const ctx = useMemo(
    () => ({
      viewerRole: data.viewer.role,
      staffRoleCategory: staffCategory,
      actorFiUserId: null,
    }),
    [data.viewer.role, staffCategory],
  );

  const canExtract = surgeryOsGraftActionAllowed(ctx, "add_extraction_count");
  const canImplant = surgeryOsGraftActionAllowed(ctx, "add_implantation_count");
  const canTray = surgeryOsGraftActionAllowed(ctx, "enter_tray_count");
  const canConfirmTray = surgeryOsGraftActionAllowed(ctx, "confirm_tray_count");
  const canCorrect = surgeryOsGraftActionAllowed(ctx, "correct_graft_count");
  const canReconcile = surgeryOsGraftActionAllowed(ctx, "reconcile_grafts");

  const defaultMode: CountingMode = canTray
    ? "tray"
    : canExtract || canImplant
      ? "quick_tap"
      : canConfirmTray
        ? "tray"
        : canCorrect
          ? "correction"
          : "quick_tap";

  const countableSurgeries = useMemo(
    () =>
      data.liveSurgeries.filter((s) => s.graftCountingEligible || isAdmin),
    [data.liveSurgeries, isAdmin],
  );

  const defaultSurgeryId =
    (initialSurgeryId && countableSurgeries.some((s) => s.id === initialSurgeryId)
      ? initialSurgeryId
      : countableSurgeries.find((s) => s.liveStatus === "active")?.id) ??
    countableSurgeries[0]?.id ??
    "";

  const [surgeryId, setSurgeryId] = useState(defaultSurgeryId);
  const [mode, setMode] = useState<CountingMode>(defaultMode);
  const [countPhase, setCountPhase] = useState<CountPhase>("extraction");
  const [error, setError] = useState<string | null>(null);
  const [lastTap, setLastTap] = useState<string | null>(null);

  const effectiveSurgeryId = surgeryId || defaultSurgeryId;
  const selectedSurgery = countableSurgeries.find((s) => s.id === effectiveSurgeryId);
  const graft = data.graftSummary.find((g) => g.surgeryId === effectiveSurgeryId);
  const surgeryAlerts = useMemo(
    () => data.alerts.filter((a) => a.surgeryId === effectiveSurgeryId && a.kind.startsWith("graft_")),
    [data.alerts, effectiveSurgeryId],
  );
  const surgeryEvents = useMemo(
    () => data.graftEvents.filter((e) => e.surgeryId === effectiveSurgeryId),
    [data.graftEvents, effectiveSurgeryId],
  );
  const pendingTrays = useMemo(
    () => surgeryEvents.filter((e) => e.eventType === "tray_count" && e.reviewStatus === "pending"),
    [surgeryEvents],
  );
  const nextTrayNumber = useMemo(() => {
    const nums = surgeryEvents
      .map((e) => e.trayNumber)
      .filter((n): n is number => n != null);
    return nums.length ? Math.max(...nums) + 1 : 1;
  }, [surgeryEvents]);

  const extractionLock = useMemo(
    () =>
      graft
        ? resolveGraftCountSessionLock({
            kind: "extraction",
            deviceId: graft.sessionLocks.extraction.deviceId,
            heldAt: graft.sessionLocks.extraction.heldAt,
            heldByFiUserId: graft.sessionLocks.extraction.heldByFiUserId,
            heldByLabel: graft.sessionLocks.extraction.heldByLabel,
            requestingDeviceId: deviceId,
            nowMs: Date.now(),
          })
        : null,
    [graft, deviceId],
  );
  const implantationLock = useMemo(
    () =>
      graft
        ? resolveGraftCountSessionLock({
            kind: "implantation",
            deviceId: graft.sessionLocks.implantation.deviceId,
            heldAt: graft.sessionLocks.implantation.heldAt,
            heldByFiUserId: graft.sessionLocks.implantation.heldByFiUserId,
            heldByLabel: graft.sessionLocks.implantation.heldByLabel,
            requestingDeviceId: deviceId,
            nowMs: Date.now(),
          })
        : null,
    [graft, deviceId],
  );

  const graftMutationBase = useMemo(
    () => ({
      surgery_id: effectiveSurgeryId,
      device_id: deviceId,
    }),
    [effectiveSurgeryId, deviceId],
  );

  const run = useCallback(
    async (
      action: (ctx: { deviceId: string; clientSubmissionId: string }) => Promise<{ ok: boolean; error?: string }>,
      successLabel?: string,
    ) => {
      if (!selectedSurgery?.graftCountingEligible && !isAdmin) {
        setError("This surgery is not eligible for graft counting.");
        return;
      }
      setError(null);
      const result = await runGuarded(async (ctx) => {
        const response = await action(ctx);
        if (response.ok) await refresh();
        return response;
      });
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      if (successLabel) setLastTap(successLabel);
    },
    [isAdmin, refresh, runGuarded, selectedSurgery?.graftCountingEligible],
  );

  const pending = isSubmitting;

  const base = `/fi-admin/${data.tenantId}`;

  if (!countableSurgeries.length) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <BackLink href={`${base}/surgery-os`} />
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center">
          <Scissors className="mx-auto mb-3 h-10 w-10 text-violet-400/60" aria-hidden />
          <p className="text-lg font-medium text-slate-200">No active surgeries today</p>
          <p className="mt-1 text-sm text-slate-500">Graft counting opens when a live surgery is on the board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-12">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <BackLink href={`${base}/surgery-os`} />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-violet-400/90">
            Graft counting assistant
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50 sm:text-2xl">Theatre count capture</h1>
          <p className="mt-1 text-sm text-slate-500">
            Role: <span className="capitalize text-slate-300">{staffCategory ?? data.viewer.role.replace(/_/g, " ")}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={effectiveSurgeryId}
            onChange={(e) => setSurgeryId(e.target.value)}
            className={cn(fiOsChromeClasses.toolbarControlSurface, "min-h-11 px-3 py-2 text-sm text-slate-200")}
          >
            {countableSurgeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.patientLabel}
                {s.liveStatus === "active" ? " · live" : ""}
                {!s.graftCountingEligible ? " · admin only" : ""}
              </option>
            ))}
          </select>
          {graft && canReconcile ? (
            <button
              type="button"
              onClick={() => {
                const exportDoc = buildGraftSummaryExport({
                  tenantName: data.tenantName,
                  patientLabel: graft.patientLabel,
                  surgeryId: graft.surgeryId,
                  exportedAt: new Date().toISOString(),
                  totals: graft.totals,
                  reconciliationStatus: graft.reconciliationStatus,
                  reconciledAt: graft.reconciledAt,
                  reconciledByLabel: graft.reconciledByLabel,
                  reconciliationNote:
                    data.graftEvents.find(
                      (e) => e.surgeryId === graft.surgeryId && e.eventType === "graft_reconciliation",
                    )?.note ?? null,
                  events: surgeryEvents.map((e) => ({
                    eventType: e.eventType,
                    reviewStatus: e.reviewStatus,
                    singles: e.singles,
                    doubles: e.doubles,
                    triples: e.triples,
                    multiples: e.multiples,
                    totalHairs: e.totalHairs,
                    deltaDiscarded: e.deltaDiscarded,
                  })),
                });
                const blob = new Blob([JSON.stringify(exportDoc, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `graft-summary-${graft.surgeryId.slice(0, 8)}.json`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200",
              )}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing || pending}
            className={cn(
              fiOsChromeClasses.toolbarControlSurface,
              "inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-semibold text-violet-100",
            )}
          >
            <RefreshCw className={cn("h-4 w-4", (isRefreshing || pending) && "animate-spin")} aria-hidden />
            Sync
          </button>
        </div>
      </header>

      {graft ? <StatsBar graft={graft} /> : null}

      {selectedSurgery && !selectedSurgery.graftCountingEligible ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Admin override active — this surgery is completed/cancelled. Counting is audit-only and requires manager
          approval.
        </div>
      ) : null}

      {extractionLock && !extractionLock.isHeldByDevice && extractionLock.deviceId && !extractionLock.isStale ? (
        <SessionLockBanner lock={extractionLock} />
      ) : null}
      {implantationLock && !implantationLock.isHeldByDevice && implantationLock.deviceId && !implantationLock.isStale ? (
        <SessionLockBanner lock={implantationLock} />
      ) : null}

      {surgeryAlerts.length > 0 ? <GraftAlertsPanel alerts={surgeryAlerts} /> : null}

      <SaveStateIndicator saveState={saveState} />

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}
      {refreshError ? <p className="text-xs text-rose-400">{refreshError}</p> : null}
      {lastTap ? (
        <p className="text-center text-sm text-emerald-400/90" aria-live="polite">
          {lastTap}
        </p>
      ) : null}

      {canConfirmTray && pendingTrays.length > 0 ? (
        <TrayReviewPanel
          pendingTrays={pendingTrays}
          pending={pending}
          onConfirm={(trayEventId, approved, note) =>
            run(
              (ctx) =>
                confirmTrayGraftCountAction(data.tenantId, {
                  ...graftMutationBase,
                  tray_event_id: trayEventId,
                  approved,
                  note,
                  client_submission_id: ctx.clientSubmissionId,
                }),
              approved ? "Tray confirmed" : "Tray rejected",
            )
          }
        />
      ) : null}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Counting modes">
        {MODES.map((m) => {
          const allowed =
            (m.id === "quick_tap" && (canExtract || canImplant)) ||
            (m.id === "tray" && canTray) ||
            (m.id === "batch" && (canExtract || canImplant || canTray)) ||
            (m.id === "manual" && (canExtract || canImplant || canTray)) ||
            (m.id === "correction" && (canCorrect || canReconcile));
          if (!allowed) return null;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition touch-manipulation",
                mode === m.id
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40"
                  : "border border-white/10 bg-slate-900/60 text-slate-400 hover:text-slate-200",
              )}
            >
              {m.label}
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-violet-500/20 bg-slate-900/60 p-4 sm:p-6">
        {mode === "quick_tap" ? (
          <QuickTapPanel
            countPhase={countPhase}
            onPhaseChange={setCountPhase}
            canExtract={canExtract}
            canImplant={canImplant}
            pending={pending}
            onTap={(graftType, count) => {
              const label = `${countPhase === "extraction" ? "Extracted" : "Implanted"} +${count} ${SURGERY_OS_GRAFT_TYPE_LABELS[graftType]}`;
              run(
                (ctx) =>
                  (countPhase === "extraction"
                    ? addExtractionGraftCountAction
                    : addImplantationGraftCountAction)(data.tenantId, {
                    ...graftMutationBase,
                    count,
                    graft_type: graftType,
                    client_submission_id: ctx.clientSubmissionId,
                  }),
                label,
              );
            }}
          />
        ) : null}

        {mode === "tray" && canTray ? (
          <TrayEntryPanel
            nextTrayNumber={nextTrayNumber}
            pending={pending}
            onSubmit={(values) =>
              run(
                (ctx) =>
                  enterTrayGraftCountAction(data.tenantId, {
                    ...graftMutationBase,
                    tray_number: values.trayNumber,
                    singles: values.singles,
                    doubles: values.doubles,
                    triples: values.triples,
                    multiples: values.multiples,
                    damaged: values.damaged,
                    note: values.note,
                    client_submission_id: ctx.clientSubmissionId,
                  }),
                `Tray #${values.trayNumber} recorded`,
              )
            }
          />
        ) : null}

        {mode === "batch" ? (
          <BatchEntryPanel
            countPhase={countPhase}
            onPhaseChange={setCountPhase}
            canExtract={canExtract}
            canImplant={canImplant}
            canTray={canTray}
            pending={pending}
            onSubmitBatch={async (values) => {
              if (canTray && values.mode === "tray") {
                run(
                  (ctx) =>
                    enterTrayGraftCountAction(data.tenantId, {
                      ...graftMutationBase,
                      tray_number: values.trayNumber,
                      singles: values.singles,
                      doubles: values.doubles,
                      triples: values.triples,
                      multiples: values.multiples,
                      damaged: values.damaged,
                      note: values.note,
                      client_submission_id: ctx.clientSubmissionId,
                    }),
                  "Batch tray recorded",
                );
                return;
              }
              const total =
                values.singles + values.doubles + values.triples + values.multiples;
              if (total <= 0) {
                setError("Enter at least one graft.");
                return;
              }
              const addCount = countPhase === "extraction" ? addExtractionGraftCountAction : addImplantationGraftCountAction;

              setError(null);
              for (const [graftType, count] of [
                ["single", values.singles],
                ["double", values.doubles],
                ["triple", values.triples],
                ["multiple", values.multiples],
              ] as const) {
                if (count <= 0) continue;
                const result = await runGuarded((ctx) =>
                  addCount(data.tenantId, {
                    ...graftMutationBase,
                    count,
                    graft_type: graftType,
                    client_submission_id: ctx.clientSubmissionId,
                  }),
                );
                if (!result.ok) {
                  setError(result.error ?? "Batch entry failed.");
                  return;
                }
              }
              setLastTap(`Batch +${total} grafts`);
              await refresh();
            }}
          />
        ) : null}

        {mode === "manual" ? (
          <ManualEntryPanel
            countPhase={countPhase}
            onPhaseChange={setCountPhase}
            canExtract={canExtract}
            canImplant={canImplant}
            canTray={canTray}
            pending={pending}
            onSubmit={(values) => {
              if (values.entryKind === "tray" && canTray) {
                run(
                  (ctx) =>
                    enterTrayGraftCountAction(data.tenantId, {
                      ...graftMutationBase,
                      tray_number: values.trayNumber,
                      singles: values.singles,
                      doubles: values.doubles,
                      triples: values.triples,
                      multiples: values.multiples,
                      damaged: values.damaged,
                      note: values.note,
                      client_submission_id: ctx.clientSubmissionId,
                    }),
                  "Manual tray entry saved",
                );
                return;
              }
              const count = values.totalCount;
              if (count <= 0) {
                setError("Enter a positive graft count.");
                return;
              }
              run(
                (ctx) =>
                  (countPhase === "extraction"
                    ? addExtractionGraftCountAction
                    : addImplantationGraftCountAction)(data.tenantId, {
                    ...graftMutationBase,
                    count,
                    graft_type: values.graftType,
                    note: values.note,
                    client_submission_id: ctx.clientSubmissionId,
                  }),
                `Manual +${count}`,
              );
            }}
          />
        ) : null}

        {mode === "correction" && graft ? (
          <CorrectionPanel
            graft={graft}
            canCorrect={canCorrect}
            canReconcile={canReconcile}
            pending={pending}
            onCorrect={(values) =>
              run(
                (ctx) =>
                  correctGraftCountAction(data.tenantId, {
                    ...graftMutationBase,
                    extracted: values.extracted,
                    implanted: values.implanted,
                    discarded: values.discarded,
                    singles: values.singles,
                    doubles: values.doubles,
                    triples: values.triples,
                    multiples: values.multiples,
                    note: values.note,
                    client_submission_id: ctx.clientSubmissionId,
                  }),
                "Correction applied — original events preserved in audit log",
              )
            }
            onReconcile={(note) =>
              run(
                (ctx) =>
                  reconcileGraftsAction(data.tenantId, {
                    ...graftMutationBase,
                    note,
                    client_submission_id: ctx.clientSubmissionId,
                  }),
                "Grafts reconciled",
              )
            }
          />
        ) : null}
      </div>

      <EventLog events={surgeryEvents} />
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-300"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      SurgeryOS
    </Link>
  );
}

function StatsBar({ graft }: { graft: SurgeryOsGraftSummary }) {
  const diff = graft.extractedGrafts - graft.implantedGrafts;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      {[
        { label: "Extracted", value: graft.extractedGrafts, accent: true },
        { label: "Implanted", value: graft.implantedGrafts, accent: true },
        { label: "Remaining", value: graft.remainingGrafts, warn: graft.remainingGrafts !== 0 },
        { label: "Confirmed trays", value: graft.confirmedTrayGrafts },
        { label: "Pending trays", value: graft.pendingTrayCount, warn: graft.pendingTrayCount > 0 },
        { label: "Avg hairs/graft", value: graft.averageHairsPerGraft?.toFixed(2) ?? "—" },
        { label: "Extract − implant", value: diff, warn: diff !== graft.remainingGrafts },
      ].map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-white/[0.06] bg-slate-900/80 px-3 py-3 text-center"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{cell.label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold tabular-nums",
              cell.warn ? "text-amber-400" : cell.accent ? "text-violet-200" : "text-slate-100",
            )}
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PhaseToggle({
  countPhase,
  onPhaseChange,
  canExtract,
  canImplant,
}: {
  countPhase: CountPhase;
  onPhaseChange: (p: CountPhase) => void;
  canExtract: boolean;
  canImplant: boolean;
}) {
  if (!canExtract && !canImplant) return null;
  return (
    <div className="mb-4 flex gap-2">
      {canExtract ? (
        <button
          type="button"
          onClick={() => onPhaseChange("extraction")}
          className={cn(
            "flex-1 rounded-xl py-3 text-sm font-semibold touch-manipulation",
            countPhase === "extraction" ? "bg-cyan-700 text-white" : "border border-white/10 text-slate-400",
          )}
        >
          Extraction
        </button>
      ) : null}
      {canImplant ? (
        <button
          type="button"
          onClick={() => onPhaseChange("implantation")}
          className={cn(
            "flex-1 rounded-xl py-3 text-sm font-semibold touch-manipulation",
            countPhase === "implantation" ? "bg-emerald-700 text-white" : "border border-white/10 text-slate-400",
          )}
        >
          Implantation
        </button>
      ) : null}
    </div>
  );
}

function QuickTapPanel({
  countPhase,
  onPhaseChange,
  canExtract,
  canImplant,
  pending,
  onTap,
}: {
  countPhase: CountPhase;
  onPhaseChange: (p: CountPhase) => void;
  canExtract: boolean;
  canImplant: boolean;
  pending: boolean;
  onTap: (graftType: SurgeryOsGraftType, count: number) => void;
}) {
  const active = (countPhase === "extraction" && canExtract) || (countPhase === "implantation" && canImplant);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-400">Tap to count — each tap saves immediately to the audit log.</p>
      <PhaseToggle
        countPhase={countPhase}
        onPhaseChange={onPhaseChange}
        canExtract={canExtract}
        canImplant={canImplant}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_TAP_BUTTONS.map((btn) => (
          <button
            key={btn.label}
            type="button"
            disabled={pending || !active}
            onClick={() => onTap(btn.graftType, btn.count)}
            className={tapButtonClass}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {pending ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-violet-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Saving…
        </p>
      ) : null}
    </div>
  );
}

function TrayEntryPanel({
  nextTrayNumber,
  pending,
  onSubmit,
}: {
  nextTrayNumber: number;
  pending: boolean;
  onSubmit: (values: {
    trayNumber: number;
    singles: number;
    doubles: number;
    triples: number;
    multiples: number;
    damaged: number;
    note: string | null;
  }) => void;
}) {
  const [trayNumber, setTrayNumber] = useState(String(nextTrayNumber));
  const [singles, setSingles] = useState("0");
  const [doubles, setDoubles] = useState("0");
  const [triples, setTriples] = useState("0");
  const [multiples, setMultiples] = useState("0");
  const [damaged, setDamaged] = useState("0");
  const [note, setNote] = useState("");

  const composition = {
    singles: Number.parseInt(singles, 10) || 0,
    doubles: Number.parseInt(doubles, 10) || 0,
    triples: Number.parseInt(triples, 10) || 0,
    multiples: Number.parseInt(multiples, 10) || 0,
  };
  const trayGrafts = computeGraftCompositionTotal(composition);
  const trayHairs = computeTrayHairTotal(composition);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Count a full tray. Totals accumulate — nurse review required before implantation reconciliation.
      </p>
      <label className="block text-sm text-slate-500">
        Tray number
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={trayNumber}
          onChange={(e) => setTrayNumber(e.target.value)}
          className={fieldClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Singles", singles, setSingles],
            ["Doubles", doubles, setDoubles],
            ["Triples", triples, setTriples],
            ["Multiples", multiples, setMultiples],
          ] as const
        ).map(([label, value, setter]) => (
          <label key={label} className="block text-sm text-slate-500">
            {label}
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className={fieldClass}
            />
          </label>
        ))}
      </div>
      <label className="block text-sm text-slate-500">
        Discarded / damaged
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={damaged}
          onChange={(e) => setDamaged(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm text-slate-500">
        Notes
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={cn(fieldClass, "text-base")}
        />
      </label>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
        <p className="text-slate-500">
          Tray grafts: <span className="font-bold text-slate-100">{trayGrafts}</span>
        </p>
        <p className="text-slate-500">
          Tray hairs: <span className="font-bold text-slate-100">{trayHairs}</span>
        </p>
      </div>
      <button
        type="button"
        disabled={pending || (trayGrafts <= 0 && (Number.parseInt(damaged, 10) || 0) <= 0)}
        onClick={() =>
          onSubmit({
            trayNumber: Number.parseInt(trayNumber, 10) || nextTrayNumber,
            singles: composition.singles,
            doubles: composition.doubles,
            triples: composition.triples,
            multiples: composition.multiples,
            damaged: Number.parseInt(damaged, 10) || 0,
            note: note.trim() || null,
          })
        }
        className={cn(tapButtonClass, "w-full min-h-[3.5rem]")}
      >
        Record tray count
      </button>
    </div>
  );
}

function BatchEntryPanel(props: {
  countPhase: CountPhase;
  onPhaseChange: (p: CountPhase) => void;
  canExtract: boolean;
  canImplant: boolean;
  canTray: boolean;
  pending: boolean;
  onSubmitBatch: (values: {
    mode: "count" | "tray";
    trayNumber: number;
    singles: number;
    doubles: number;
    triples: number;
    multiples: number;
    damaged: number;
    note: string | null;
  }) => void;
}) {
  const [singles, setSingles] = useState("");
  const [doubles, setDoubles] = useState("");
  const [triples, setTriples] = useState("");
  const [multiples, setMultiples] = useState("");

  return (
    <div>
      <p className="mb-4 text-sm text-slate-400">Enter all graft types for this batch, then submit once.</p>
      {!props.canTray ? (
        <PhaseToggle
          countPhase={props.countPhase}
          onPhaseChange={props.onPhaseChange}
          canExtract={props.canExtract}
          canImplant={props.canImplant}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Singles", singles, setSingles],
            ["Doubles", doubles, setDoubles],
            ["Triples", triples, setTriples],
            ["Multiples", multiples, setMultiples],
          ] as const
        ).map(([label, value, setter]) => (
          <label key={label} className="block text-sm text-slate-500">
            {label}
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className={fieldClass}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={props.pending}
        onClick={() =>
          props.onSubmitBatch({
            mode: props.canTray ? "tray" : "count",
            trayNumber: 1,
            singles: Number.parseInt(singles, 10) || 0,
            doubles: Number.parseInt(doubles, 10) || 0,
            triples: Number.parseInt(triples, 10) || 0,
            multiples: Number.parseInt(multiples, 10) || 0,
            damaged: 0,
            note: null,
          })
        }
        className={cn(tapButtonClass, "mt-4 w-full min-h-[3.5rem]")}
      >
        Submit batch
      </button>
    </div>
  );
}

function ManualEntryPanel(props: {
  countPhase: CountPhase;
  onPhaseChange: (p: CountPhase) => void;
  canExtract: boolean;
  canImplant: boolean;
  canTray: boolean;
  pending: boolean;
  onSubmit: (values: {
    entryKind: "count" | "tray";
    totalCount: number;
    graftType?: SurgeryOsGraftType;
    trayNumber: number;
    singles: number;
    doubles: number;
    triples: number;
    multiples: number;
    damaged: number;
    note: string | null;
  }) => void;
}) {
  const [entryKind, setEntryKind] = useState<"count" | "tray">(props.canTray ? "tray" : "count");
  const [totalCount, setTotalCount] = useState("");
  const [graftType, setGraftType] = useState<SurgeryOsGraftType>("single");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100/90">
        <Mic className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
        <p>
          Voice-friendly manual entry — large fields for tablet use. Dictate counts to a scribe; voice capture
          integration coming in a later phase.
        </p>
      </div>
      {props.canTray ? (
        <div className="flex gap-2">
          {(["count", "tray"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setEntryKind(k)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize",
                entryKind === k ? "bg-violet-700 text-white" : "border border-white/10 text-slate-400",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      ) : null}
      {entryKind === "count" ? (
        <>
          <PhaseToggle
            countPhase={props.countPhase}
            onPhaseChange={props.onPhaseChange}
            canExtract={props.canExtract}
            canImplant={props.canImplant}
          />
          <label className="block text-sm text-slate-500">
            Graft count
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={totalCount}
              onChange={(e) => setTotalCount(e.target.value)}
              className={cn(fieldClass, "text-2xl")}
              aria-label="Graft count for manual entry"
            />
          </label>
          <label className="block text-sm text-slate-500">
            Graft type
            <select
              value={graftType}
              onChange={(e) => setGraftType(e.target.value as SurgeryOsGraftType)}
              className={fieldClass}
            >
              {(Object.keys(SURGERY_OS_GRAFT_TYPE_LABELS) as SurgeryOsGraftType[]).map((t) => (
                <option key={t} value={t}>
                  {SURGERY_OS_GRAFT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <TrayEntryPanel nextTrayNumber={1} pending={props.pending} onSubmit={(v) => props.onSubmit({ entryKind: "tray", totalCount: 0, graftType, ...v })} />
      )}
      {entryKind === "count" ? (
        <>
          <label className="block text-sm text-slate-500">
            Note (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldClass} />
          </label>
          <button
            type="button"
            disabled={props.pending}
            onClick={() =>
              props.onSubmit({
                entryKind: "count",
                totalCount: Number.parseInt(totalCount, 10) || 0,
                graftType,
                trayNumber: 1,
                singles: 0,
                doubles: 0,
                triples: 0,
                multiples: 0,
                damaged: 0,
                note: note.trim() || null,
              })
            }
            className={cn(tapButtonClass, "w-full min-h-[3.5rem]")}
          >
            Save manual count
          </button>
        </>
      ) : null}
    </div>
  );
}

function CorrectionPanel({
  graft,
  canCorrect,
  canReconcile,
  pending,
  onCorrect,
  onReconcile,
}: {
  graft: SurgeryOsGraftSummary;
  canCorrect: boolean;
  canReconcile: boolean;
  pending: boolean;
  onCorrect: (values: {
    extracted: number;
    implanted: number;
    discarded: number;
    singles: number;
    doubles: number;
    triples: number;
    multiples: number;
    note: string | null;
  }) => void;
  onReconcile: (note: string | null) => void;
}) {
  const [extracted, setExtracted] = useState(String(graft.extractedGrafts));
  const [implanted, setImplanted] = useState(String(graft.implantedGrafts));
  const [discarded, setDiscarded] = useState(String(graft.discardedGrafts));
  const [singles, setSingles] = useState(String(graft.singles));
  const [doubles, setDoubles] = useState(String(graft.doubles));
  const [triples, setTriples] = useState(String(graft.triples));
  const [multiples, setMultiples] = useState(String(graft.multiples));
  const [note, setNote] = useState("");
  const [reconcileNote, setReconcileNote] = useState("");

  const magnitude = computeGraftCorrectionMagnitude({
    previous: {
      extracted: graft.extractedGrafts,
      implanted: graft.implantedGrafts,
      discarded: graft.discardedGrafts,
    },
    next: {
      extracted: Number.parseInt(extracted, 10) || 0,
      implanted: Number.parseInt(implanted, 10) || 0,
      discarded: Number.parseInt(discarded, 10) || 0,
    },
  });
  const noteRequired = requiresLargeCorrectionNote(magnitude);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Corrections append audit events — original counts are never deleted. Changes of{" "}
        {SURGERY_OS_GRAFT_LARGE_CORRECTION_THRESHOLD}+ grafts require a note.
      </p>
      {canCorrect ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Extracted", extracted, setExtracted],
                ["Implanted", implanted, setImplanted],
                ["Discarded", discarded, setDiscarded],
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="block text-sm text-slate-500">
                {label}
                <input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Singles", singles, setSingles],
                ["Doubles", doubles, setDoubles],
                ["Triples", triples, setTriples],
                ["Multiples", multiples, setMultiples],
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="block text-sm text-slate-500">
                {label}
                <input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          <label className="block text-sm text-slate-500">
            Reason {noteRequired ? <span className="text-rose-400">(required)</span> : "(optional)"}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={fieldClass}
              placeholder={noteRequired ? "Explain this large correction…" : undefined}
            />
          </label>
          <button
            type="button"
            disabled={pending || (noteRequired && !note.trim())}
            onClick={() =>
              onCorrect({
                extracted: Number.parseInt(extracted, 10) || 0,
                implanted: Number.parseInt(implanted, 10) || 0,
                discarded: Number.parseInt(discarded, 10) || 0,
                singles: Number.parseInt(singles, 10) || 0,
                doubles: Number.parseInt(doubles, 10) || 0,
                triples: Number.parseInt(triples, 10) || 0,
                multiples: Number.parseInt(multiples, 10) || 0,
                note: note.trim() || null,
              })
            }
            className={cn(tapButtonClass, "w-full min-h-[3.5rem] border-amber-500/30 bg-amber-950/30 text-amber-50")}
          >
            Apply correction
          </button>
        </div>
      ) : null}

      {canReconcile ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <p className="text-sm text-slate-300">
            Reconciliation requires remaining = 0 and no pending trays. Current remaining:{" "}
            <span className={graft.remainingGrafts === 0 ? "text-emerald-400" : "text-rose-400"}>
              {graft.remainingGrafts}
            </span>
            {graft.pendingTrayCount > 0 ? (
              <span className="text-rose-400"> · {graft.pendingTrayCount} tray(s) pending review</span>
            ) : null}
          </p>
          <label className="mt-3 block text-sm text-slate-500">
            Reconciliation note
            <textarea
              value={reconcileNote}
              onChange={(e) => setReconcileNote(e.target.value)}
              rows={2}
              className={fieldClass}
            />
          </label>
          <button
            type="button"
            disabled={pending || graft.remainingGrafts !== 0 || graft.pendingTrayCount > 0}
            onClick={() => onReconcile(reconcileNote.trim() || null)}
            className={cn(tapButtonClass, "mt-3 w-full min-h-[3.5rem] border-emerald-500/30 bg-emerald-900/40")}
          >
            Complete reconciliation
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TrayReviewPanel({
  pendingTrays,
  pending,
  onConfirm,
}: {
  pendingTrays: SurgeryOsGraftCountEvent[];
  pending: boolean;
  onConfirm: (trayEventId: string, approved: boolean, note: string | null) => void;
}) {
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4">
      <p className="text-sm font-semibold text-amber-200">Nurse tray review queue ({pendingTrays.length})</p>
      <p className="mt-1 text-xs text-amber-100/70">
        Confirmed trays contribute to totals. Rejected trays remain in the audit log only.
      </p>
      <ul className="mt-3 space-y-3">
        {pendingTrays.map((tray) => {
          const grafts =
            (tray.singles ?? 0) + (tray.doubles ?? 0) + (tray.triples ?? 0) + (tray.multiples ?? 0);
          return (
            <li
              key={tray.id}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-slate-900/60 p-3"
            >
              <div>
                <p className="font-medium text-slate-100">
                  Tray #{tray.trayNumber ?? "—"} · {tray.createdByLabel ?? "Technician"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {grafts} grafts · {tray.totalHairs ?? "—"} hairs · {tray.deltaDiscarded} damaged/discarded
                </p>
                {tray.note ? <p className="mt-1 text-xs text-slate-400">{tray.note}</p> : null}
              </div>
              <label className="block text-xs text-slate-500">
                Review note
                <input
                  type="text"
                  value={rejectNotes[tray.id] ?? ""}
                  onChange={(e) => setRejectNotes((prev) => ({ ...prev, [tray.id]: e.target.value }))}
                  placeholder="Optional for confirm; recommended for reject"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onConfirm(tray.id, true, rejectNotes[tray.id]?.trim() || null)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white touch-manipulation disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    onConfirm(
                      tray.id,
                      false,
                      rejectNotes[tray.id]?.trim() || "Rejected at nurse review",
                    )
                  }
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2 text-sm font-semibold text-rose-200 touch-manipulation disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  Reject
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SessionLockBanner({ lock }: { lock: SurgeryOsGraftCountSessionLock }) {
  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
      Another tablet holds the active {lock.kind} count session
      {lock.heldByLabel ? ` (${lock.heldByLabel})` : ""}. Counting is disabled on this device until the lock
      expires or the other session ends.
    </div>
  );
}

function GraftAlertsPanel({ alerts }: { alerts: SurgeryOsAlert[] }) {
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
            alert.severity === "blocked" || alert.severity === "critical"
              ? "border-rose-500/30 bg-rose-950/30 text-rose-100"
              : "border-amber-500/25 bg-amber-950/20 text-amber-100",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{alert.title}</p>
            <p className="mt-0.5 text-xs opacity-90">{alert.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SaveStateIndicator({ saveState }: { saveState: GraftSaveState }) {
  if (saveState === "idle") return null;
  return (
    <p
      className={cn(
        "text-center text-sm",
        saveState === "saving" ? "text-violet-300" : "text-emerald-400",
      )}
      aria-live="polite"
    >
      {saveState === "saving" ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Saving…
        </span>
      ) : (
        "Saved"
      )}
    </p>
  );
}

function EventLog({ events }: { events: SurgeryOsGraftCountEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Audit log</h2>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {events.slice(0, 30).map((e) => (
          <li key={e.id} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-200">{e.eventTypeLabel}</span>
              <span className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleTimeString()}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {e.deltaExtracted > 0 ? `+${e.deltaExtracted} extracted · ` : ""}
              {e.deltaImplanted > 0 ? `+${e.deltaImplanted} implanted · ` : ""}
              {e.deltaDiscarded > 0 ? `+${e.deltaDiscarded} discarded · ` : ""}
              {e.note ?? ""}
            </p>
            {e.reviewStatus ? (
              <p
                className={cn(
                  "mt-1 text-xs font-semibold capitalize",
                  e.reviewStatus === "confirmed"
                    ? "text-emerald-400"
                    : e.reviewStatus === "rejected"
                      ? "text-rose-400"
                      : "text-amber-400",
                )}
              >
                {e.reviewStatus}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
