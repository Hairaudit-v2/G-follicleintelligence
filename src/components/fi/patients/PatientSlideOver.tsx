"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadPatientSlideOverBundleAction } from "@/lib/actions/fi-patient-actions";
import type { PatientSlideOverPayload } from "@/src/lib/patients/patientSlideOverLoader";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";
import { PatientBookNextAppointmentCard } from "./shared/PatientBookNextAppointmentCard";
import { PatientConsultationsCard } from "./shared/PatientConsultationsCard";
import { PatientPersonLeadHistoryCard } from "./shared/PatientPersonLeadHistoryCard";
import { PatientStatusBadge } from "./PatientStatusBadge";
import { PatientPhotoCaptureActions } from "./PatientPhotoCaptureActions";
import { useWorkspaceShellOptional } from "@/src/components/fi-os/workspace/WorkspaceShellContext";
import { WorkspaceFeedLink } from "@/src/components/fi-os/workspace/WorkspaceFeedLink";
import type { WorkspacePanelSignalRefresh } from "@/src/components/fi-os/workspace/useWorkspacePanelSignalRefresh";
import { WorkspaceSignalHeaderHint } from "@/src/components/fi-os/workspace/panels/WorkspaceShellPanelFrame";

export type PatientShellOperatorContext = {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
};

type SlideOverCtx = PatientShellOperatorContext & {
  /** Patient id currently shown in the slide-over drawer, if any. */
  activePatientId: string | null;
  canCapturePatientPhotos?: boolean;
  openPatient: (patientId: string) => void;
  close: () => void;
};

const PatientSlideOverContext = createContext<SlideOverCtx | null>(null);

export function usePatientSlideOver(): SlideOverCtx {
  const v = useContext(PatientSlideOverContext);
  if (!v) throw new Error("usePatientSlideOver must be used within PatientSlideOverProvider");
  return v;
}

export function usePatientSlideOverOptional(): SlideOverCtx | null {
  return useContext(PatientSlideOverContext);
}

export function PatientSlideOverProvider({
  tenantId,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  canCapturePatientPhotos = false,
  children,
}: {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
  canCapturePatientPhotos?: boolean;
  children: ReactNode;
}) {
  const workspaceShell = useWorkspaceShellOptional();
  const [patientId, setPatientId] = useState<string | null>(null);
  const openPatient = useCallback((id: string) => setPatientId(id.trim()), []);
  const close = useCallback(() => setPatientId(null), []);

  const bridgedOpenPatient = useCallback(
    (id: string) => {
      if (workspaceShell) {
        workspaceShell.openWorkspace({ kind: "patient", id: id.trim() });
        return;
      }
      openPatient(id);
    },
    [workspaceShell, openPatient]
  );

  const bridgedClose = useCallback(() => {
    if (workspaceShell) {
      workspaceShell.closeAll();
      return;
    }
    close();
  }, [workspaceShell, close]);

  const activePatientId = workspaceShell
    ? (workspaceShell.activeOfKind("patient")?.id ?? null)
    : patientId;

  const value = useMemo(
    () => ({
      tenantId,
      operatorFiUserId,
      userRole,
      canUseClinicFeatures,
      canCapturePatientPhotos,
      activePatientId,
      openPatient: bridgedOpenPatient,
      close: bridgedClose,
    }),
    [
      tenantId,
      operatorFiUserId,
      userRole,
      canUseClinicFeatures,
      canCapturePatientPhotos,
      activePatientId,
      bridgedOpenPatient,
      bridgedClose,
    ]
  );

  if (workspaceShell) {
    return (
      <PatientSlideOverContext.Provider value={value}>{children}</PatientSlideOverContext.Provider>
    );
  }

  return (
    <PatientSlideOverContext.Provider value={value}>
      {children}
      <PatientSlideOverPanel
        tenantId={tenantId}
        patientId={patientId}
        open={patientId != null}
        onClose={close}
        operatorFiUserId={operatorFiUserId}
        userRole={userRole}
        canCapturePatientPhotos={canCapturePatientPhotos}
      />
    </PatientSlideOverContext.Provider>
  );
}

/** Right-hand slide-over panel (use {@link PatientSlideOverProvider} + {@link usePatientSlideOver} or render directly). */
export function PatientSlideOverPanel({
  tenantId,
  patientId,
  open,
  onClose,
  operatorFiUserId: _operatorFiUserId,
  userRole: _userRole,
  canCapturePatientPhotos = false,
  signalRefreshToken = 0,
  lastSignalReason,
  lastSignalAt,
}: {
  tenantId: string;
  patientId: string | null;
  open: boolean;
  onClose: () => void;
  operatorFiUserId: string;
  userRole: string;
  canCapturePatientPhotos?: boolean;
} & WorkspacePanelSignalRefresh) {
  void _operatorFiUserId;
  void _userRole;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PatientSlideOverPayload | null>(null);

  useEffect(() => {
    if (!open || !patientId) {
      setPayload(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void loadPatientSlideOverBundleAction(tenantId, patientId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setPayload(null);
        setLoadError(r.error);
        return;
      }
      setPayload(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, patientId, tenantId, signalRefreshToken]);

  const href = payload ? `/fi-admin/${tenantId}/patients/${payload.patientId}` : "#";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30 sm:items-stretch"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Patient preview"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-100">Patient preview</h2>
            <WorkspaceSignalHeaderHint
              lastSignalReason={lastSignalReason}
              lastSignalAt={lastSignalAt}
              signalRefreshToken={signalRefreshToken}
            />
            {payload ? (
              <Link
                href={href}
                className="text-xs text-blue-300 hover:underline"
                onClick={() => onClose()}
              >
                Open full profile →
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 text-sm text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {loading ? <p className="text-slate-400">Loading…</p> : null}
          {loadError ? (
            <div
              className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300"
              role="alert"
            >
              {loadError}
            </div>
          ) : null}

          {!loading && payload ? (
            <div className="space-y-4 pb-24">
              <section className={crmLeadCardClass}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Patient
                    </h3>
                    <p className="mt-1 font-medium text-slate-100">{payload.displayName}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {payload.email ?? "—"} · {payload.phone ?? "—"}
                    </p>
                  </div>
                  <PatientStatusBadge status={payload.patientStatus} />
                </div>
                <PatientPhotoCaptureActions
                  tenantId={tenantId}
                  patientId={payload.patientId}
                  canCapture={canCapturePatientPhotos}
                  source="patient_slide_over"
                  className="mt-3"
                  onNavigate={onClose}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Since {payload.createdAt.slice(0, 10)} · ID{" "}
                  <code className="rounded bg-white/[0.06] px-1">
                    {payload.patientId.slice(0, 8)}…
                  </code>
                </p>
              </section>

              <section className={crmLeadCardClass}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Clinical summary
                </h3>
                <p className="mt-2 text-sm text-slate-200">
                  {payload.clinicalScalesSummary ?? "No Norwood / clinical summary on file yet."}
                </p>
              </section>

              <section className={crmLeadCardClass}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Hair clinic ops
                </h3>
                <dl className="mt-2 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-gray-500">Next appointment</dt>
                    <dd className="font-medium">
                      {payload.nextAppointmentAt ? (
                        payload.nextAppointmentId ? (
                          <WorkspaceFeedLink
                            href={`/fi-admin/${tenantId}/appointments/${payload.nextAppointmentId}`}
                            push
                            className="text-blue-300 hover:underline"
                          >
                            {payload.nextAppointmentAt.slice(0, 16).replace("T", " ")}
                          </WorkspaceFeedLink>
                        ) : (
                          payload.nextAppointmentAt.slice(0, 16).replace("T", " ")
                        )
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Last visit</dt>
                    <dd className="font-medium">
                      {payload.lastVisitAt?.slice(0, 16).replace("T", " ") ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Completed procedures</dt>
                    <dd className="font-medium tabular-nums">{payload.totalProcedures}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Lifetime value</dt>
                    <dd className="font-medium tabular-nums">{payload.lifetimeValueLabel}</dd>
                  </div>
                </dl>
              </section>

              <PatientBookNextAppointmentCard
                tenantId={tenantId}
                patientId={payload.patientId}
                personId={payload.personId}
                displayName={payload.displayName}
                primaryLead={payload.primaryLead}
                bookings={payload.bookingRows}
                groupingNowIso={payload.groupingNowIso}
                compact
              />

              <PatientConsultationsCard
                tenantId={tenantId}
                consultations={payload.consultations}
                compact
              />

              <PatientPersonLeadHistoryCard
                tenantId={tenantId}
                currentPatientId={payload.patientId}
                items={payload.personLeadHistory}
                activity={payload.personCrmActivity}
                compact
              />

              <section className={crmLeadCardClass}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Linked records
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-200">
                  <li>
                    <strong>{payload.linkedLeadCount}</strong> CRM lead
                    {payload.linkedLeadCount === 1 ? "" : "s"}
                  </li>
                  <li>
                    <strong>{payload.activeCaseCount}</strong> active case
                    {payload.activeCaseCount === 1 ? "" : "s"}
                  </li>
                  <li>
                    <strong>{payload.upcomingBookingCount}</strong> upcoming booking
                    {payload.upcomingBookingCount === 1 ? "" : "s"}
                  </li>
                </ul>
              </section>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={href}
                  className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  onClick={() => {
                    onClose();
                    router.push(href);
                  }}
                >
                  Open profile
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {payload ? (
          <PatientPhotoCaptureActions
            tenantId={tenantId}
            patientId={payload.patientId}
            canCapture={canCapturePatientPhotos}
            source="patient_slide_over"
            variant="mobile-bar"
            onNavigate={onClose}
          />
        ) : null}
      </aside>
    </div>
  );
}

export { PatientSlideOverPanel as PatientSlideOver };
