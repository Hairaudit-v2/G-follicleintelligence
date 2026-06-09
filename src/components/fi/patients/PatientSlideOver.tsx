"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadPatientSlideOverBundleAction } from "@/lib/actions/fi-patient-actions";
import type { PatientSlideOverPayload } from "@/src/lib/patients/patientSlideOverLoader";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";
import { PatientBookNextAppointmentCard } from "./shared/PatientBookNextAppointmentCard";
import { PatientConsultationsCard } from "./shared/PatientConsultationsCard";
import { PatientPersonLeadHistoryCard } from "./shared/PatientPersonLeadHistoryCard";
import { PatientStatusBadge } from "./PatientStatusBadge";

export type PatientShellOperatorContext = {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
};

type SlideOverCtx = PatientShellOperatorContext & {
  /** Patient id currently shown in the slide-over drawer, if any. */
  activePatientId: string | null;
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
  children,
}: {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
  children: ReactNode;
}) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const openPatient = useCallback((id: string) => setPatientId(id.trim()), []);
  const close = useCallback(() => setPatientId(null), []);

  const value = useMemo(
    () => ({ tenantId, operatorFiUserId, userRole, canUseClinicFeatures, activePatientId: patientId, openPatient, close }),
    [tenantId, operatorFiUserId, userRole, canUseClinicFeatures, patientId, openPatient, close]
  );

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
}: {
  tenantId: string;
  patientId: string | null;
  open: boolean;
  onClose: () => void;
  operatorFiUserId: string;
  userRole: string;
}) {
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
  }, [open, patientId, tenantId]);

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
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-gray-200 bg-white shadow-xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Patient preview"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-900">Patient preview</h2>
            {payload ? (
              <Link href={href} className="text-xs text-blue-600 hover:underline" onClick={() => onClose()}>
                Open full profile →
              </Link>
            ) : null}
          </div>
          <button type="button" className="shrink-0 text-sm text-gray-600 hover:text-gray-900" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {loading ? <p className="text-gray-600">Loading…</p> : null}
          {loadError ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
              {loadError}
            </div>
          ) : null}

          {!loading && payload ? (
            <div className="space-y-4">
              <section className={crmLeadCardClass}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Patient</h3>
                    <p className="mt-1 font-medium text-gray-900">{payload.displayName}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {payload.email ?? "—"} · {payload.phone ?? "—"}
                    </p>
                  </div>
                  <PatientStatusBadge status={payload.patientStatus} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Since {payload.createdAt.slice(0, 10)} · ID{" "}
                  <code className="rounded bg-gray-100 px-1">{payload.patientId.slice(0, 8)}…</code>
                </p>
              </section>

              <section className={crmLeadCardClass}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Clinical summary</h3>
                <p className="mt-2 text-sm text-gray-800">
                  {payload.clinicalScalesSummary ?? "No Norwood / clinical summary on file yet."}
                </p>
              </section>

              <section className={crmLeadCardClass}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hair clinic ops</h3>
                <dl className="mt-2 grid gap-2 text-sm text-gray-800 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-gray-500">Next appointment</dt>
                    <dd className="font-medium">
                      {payload.nextAppointmentAt ? (
                        payload.nextAppointmentId ? (
                          <Link
                            href={`/fi-admin/${tenantId}/appointments/${payload.nextAppointmentId}`}
                            className="text-blue-700 hover:underline"
                            onClick={() => onClose()}
                          >
                            {payload.nextAppointmentAt.slice(0, 16).replace("T", " ")}
                          </Link>
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
                    <dd className="font-medium">{payload.lastVisitAt?.slice(0, 16).replace("T", " ") ?? "—"}</dd>
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

              <PatientConsultationsCard tenantId={tenantId} consultations={payload.consultations} compact />

              <PatientPersonLeadHistoryCard
                tenantId={tenantId}
                currentPatientId={payload.patientId}
                items={payload.personLeadHistory}
                activity={payload.personCrmActivity}
                compact
              />

              <section className={crmLeadCardClass}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Linked records</h3>
                <ul className="mt-2 space-y-1 text-sm text-gray-800">
                  <li>
                    <strong>{payload.linkedLeadCount}</strong> CRM lead{payload.linkedLeadCount === 1 ? "" : "s"}
                  </li>
                  <li>
                    <strong>{payload.activeCaseCount}</strong> active case{payload.activeCaseCount === 1 ? "" : "s"}
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
      </aside>
    </div>
  );
}

export { PatientSlideOverPanel as PatientSlideOver };
