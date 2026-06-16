"use client";

import type { FocusEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { updateConsultationDraftAction } from "@/lib/actions/fi-consultation-actions";
import { ConsultationCompletionSummaryCard } from "@/src/components/fi-admin/consultation-forms/ConsultationCompletionSummaryCard";
import { ConsultationPathwayLauncher } from "@/src/components/fi-admin/consultations/ConsultationPathwayLauncher";
import { ConsultationLeadLinkField } from "@/src/components/fi-admin/consultations/ConsultationLeadLinkField";
import { ConsultationPatientLinkField } from "@/src/components/fi-admin/consultations/ConsultationPatientLinkField";
import { ConsultationOsHubRoutingActions } from "@/src/components/fi-admin/consultations/ConsultationOsHubRoutingActions";
import { ConsultationPreparationChecklistPanel } from "@/src/components/fi-admin/consultations/ConsultationPreparationChecklistPanel";
import { StaffClinicalSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import {
  stableConsultationPayloadSignature,
  useConsultationAutosave,
} from "@/src/components/fi-admin/consultations/useConsultationAutosave";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import type { PatientTwinConsultationChecklistRow } from "@/src/lib/patientTwin/patientTwinTypes";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type { ConsultationLinkSearchLeadHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import type { ConsultationLinkSearchPatientHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import { parsePathwayCompletionFromConsultationStructured } from "@/src/lib/consultations/consultationCompletionSummaryParse";
import { buildConsultationHubLayoutPlan, type ConsultationHubSectionId } from "@/src/lib/consultations/consultationHubLayoutPlan";
import type { ConsultationPathwayLauncherViewModel } from "@/src/lib/consultations/consultationPathwayLauncherModel";
import type { ConsultationWorkspaceDisplay } from "@/src/lib/consultations/consultationLoaders.server";
import { getConsultationTypeDefinition } from "@/src/lib/consultations/consultationTypeConfig";
import { CONSULTATION_EDITABLE_STATUSES, type ConsultationRow, type ConsultationStatus } from "@/src/lib/consultations/consultationTypes";

const PATHWAY_HERO_CARD_CLASS =
  "border-sky-200/90 bg-gradient-to-b from-sky-50/95 via-white to-white shadow-md ring-2 ring-sky-300/40 dark:border-sky-800/60 dark:from-sky-950/45 dark:via-slate-950/50 dark:to-slate-950/40 dark:ring-sky-800/50";

function formatStatusLabel(s: ConsultationStatus): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function statusTone(s: ConsultationStatus): "neutral" | "info" | "success" | "warning" {
  if (s === "draft") return "neutral";
  if (s === "in_progress") return "info";
  if (s === "completed" || s === "accepted" || s === "converted_to_case") return "success";
  if (s === "quoted") return "info";
  if (s === "archived") return "neutral";
  return "warning";
}

export type ConsultationOsWorkspaceProps = {
  tenantId: string;
  consultationId: string;
  initialRow: ConsultationRow;
  initialWorkspaceDisplay?: ConsultationWorkspaceDisplay | null;
  showCrmNav?: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
  initialConsultationChecklistPreview?: PatientTwinConsultationChecklistRow | null;
  pathwayLauncher: ConsultationPathwayLauncherViewModel;
};

export function ConsultationOsWorkspace({
  tenantId,
  consultationId,
  initialRow,
  initialWorkspaceDisplay = null,
  showCrmNav = false,
  clinicalStaffOptions = [],
  initialConsultationChecklistPreview = null,
  pathwayLauncher,
}: ConsultationOsWorkspaceProps) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId.trim()}`;
  const patientsHref = `${base}/patients`;
  const cid = consultationId.trim();

  const [adminKey, setAdminKey] = useState("");
  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const [status, setStatus] = useState<ConsultationStatus>(initialRow.status);
  const [consultantName, setConsultantName] = useState(initialRow.consultant_name ?? "");
  const [consultantStaffId, setConsultantStaffId] = useState(initialRow.consultant_staff_id?.trim() ?? "");
  const [consultationDate, setConsultationDate] = useState(initialRow.consultation_date ?? "");

  const [linkedPatientId, setLinkedPatientId] = useState<string | null>(() => initialRow.patient_id?.trim() ?? null);
  const [linkedPersonId, setLinkedPersonId] = useState<string | null>(() => initialRow.person_id?.trim() ?? null);
  const [linkedLeadId, setLinkedLeadId] = useState<string | null>(() => initialRow.lead_id?.trim() ?? null);
  const [linkedPatientLabel, setLinkedPatientLabel] = useState<string | null>(
    () => initialWorkspaceDisplay?.patientName ?? null
  );
  const [linkedLeadLabel, setLinkedLeadLabel] = useState<string | null>(() => initialWorkspaceDisplay?.leadName ?? null);
  const [linkedLeadStage, setLinkedLeadStage] = useState<string | null>(() => initialWorkspaceDisplay?.leadStage ?? null);

  const [busySave, setBusySave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const consultationTypeLabel = useMemo(
    () => getConsultationTypeDefinition(initialRow.consultation_type).label,
    [initialRow.consultation_type]
  );

  const pathwayCompletionSummary = useMemo(() => {
    const sd =
      initialRow.structured_data && typeof initialRow.structured_data === "object" && !Array.isArray(initialRow.structured_data)
        ? (initialRow.structured_data as Record<string, unknown>)
        : {};
    return parsePathwayCompletionFromConsultationStructured(sd);
  }, [initialRow.structured_data]);

  const hubPlan = useMemo(
    () => buildConsultationHubLayoutPlan(Boolean(pathwayCompletionSummary)),
    [pathwayCompletionSummary]
  );

  const canEdit = useMemo(
    () => (CONSULTATION_EDITABLE_STATUSES as readonly string[]).includes(status),
    [status]
  );

  const onLinkPatientHit = useCallback((hit: ConsultationLinkSearchPatientHit) => {
    setLinkedPatientId(hit.id);
    setLinkedPersonId(hit.person_id);
    setLinkedPatientLabel(hit.name);
  }, []);

  const onClearPatient = useCallback(() => {
    setLinkedPatientId(null);
    setLinkedPersonId(null);
    setLinkedPatientLabel(null);
  }, []);

  const onLinkLeadHit = useCallback((hit: ConsultationLinkSearchLeadHit) => {
    setLinkedLeadId(hit.id);
    setLinkedLeadLabel(hit.name);
    setLinkedLeadStage(hit.stageLabel);
  }, []);

  const onClearLead = useCallback(() => {
    setLinkedLeadId(null);
    setLinkedLeadLabel(null);
    setLinkedLeadStage(null);
  }, []);

  const buildPayload = useCallback(() => {
    return {
      status,
      consultant_name: consultantName.trim() === "" ? null : consultantName.trim(),
      consultant_staff_id: consultantStaffId.trim() || null,
      consultation_date: consultationDate.trim() === "" ? null : consultationDate.trim(),
      patient_id: linkedPatientId,
      person_id: linkedPersonId,
      lead_id: linkedLeadId,
    };
  }, [status, consultantName, consultantStaffId, consultationDate, linkedPatientId, linkedPersonId, linkedLeadId]);

  const payloadWatch = useMemo(() => stableConsultationPayloadSignature(buildPayload()), [buildPayload]);

  const autosaveEnabled = Boolean(cid) && canEdit;

  const {
    beginManualSave,
    markManualSaveSucceeded,
    flushOnBlur,
    autosaveSaving,
    persistStatus,
    autosaveWarning,
  } = useConsultationAutosave({
    enabled: autosaveEnabled,
    tenantId,
    consultationId: cid,
    getPayload: buildPayload,
    withAdmin,
    blockAutoschedule: busySave,
    payloadWatch,
    debounceMs: 2000,
  });

  const handleEditorBlurCapture = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (!autosaveEnabled) return;
      const rt = e.relatedTarget as Node | null;
      if (rt && e.currentTarget.contains(rt)) return;
      flushOnBlur();
    },
    [autosaveEnabled, flushOnBlur]
  );

  const onSaveDraft = useCallback(async () => {
    if (!cid) return;
    setError(null);
    setSaveOk(false);
    beginManualSave();
    setBusySave(true);
    try {
      const res = await updateConsultationDraftAction(tenantId, cid, withAdmin(buildPayload()));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      markManualSaveSucceeded();
      setSaveOk(true);
      router.refresh();
    } finally {
      setBusySave(false);
    }
  }, [cid, tenantId, withAdmin, buildPayload, router, beginManualSave, markManualSaveSucceeded]);

  const displaySaving = busySave || autosaveSaving;
  const subtleSaveLabel = (() => {
    if (displaySaving) return "Saving…";
    if (error?.trim()) return "Save failed";
    if (persistStatus === "failed") return "Save failed";
    if (persistStatus === "unsaved") return "Unsaved changes";
    return "Saved";
  })();

  const linkedBookingId = initialRow.booking_id?.trim() ? initialRow.booking_id.trim() : null;
  const appointmentHref = linkedBookingId ? `${base}/appointments/${encodeURIComponent(linkedBookingId)}` : null;

  const pathwayLauncherEl = (
    <ConsultationPathwayLauncher
      key="pathway-launcher"
      model={pathwayLauncher}
      sectionTitle={hubPlan.hasPathwayCompletionSummary ? "Pathways" : undefined}
      sectionDescription={hubPlan.hasPathwayCompletionSummary ? "Review or start another pathway." : undefined}
      cardClassName={hubPlan.hasPathwayCompletionSummary ? "" : PATHWAY_HERO_CARD_CLASS}
    />
  );

  const renderHubSection = (sectionId: ConsultationHubSectionId) => {
    switch (sectionId) {
      case "intelligence_summary":
        if (!pathwayCompletionSummary) return null;
        return (
          <section key="intelligence_summary" className="space-y-3" aria-labelledby="consultation-intel-summary-heading">
            <h2 id="consultation-intel-summary-heading" className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Consultation intelligence summary
            </h2>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Rules-based snapshot from the completed guided pathway — stored on this consultation for Twin, audit, and
              revenue hand-offs.
            </p>
            <ConsultationCompletionSummaryCard summary={pathwayCompletionSummary} />
          </section>
        );
      case "routing":
        if (!hubPlan.showRoutingTiles) return null;
        return (
          <FiCard key="routing">
            <ConsultationOsHubRoutingActions
              tenantId={tenantId}
              consultationId={cid}
              caseId={initialRow.case_id}
              leadId={linkedLeadId}
              patientId={linkedPatientId}
            />
          </FiCard>
        );
      case "pathway_launcher":
        return pathwayLauncherEl;
      case "intake":
        return (
          <div key="intake" id="consultation-hub-intake">
            <FiCard className="border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 dark:border-slate-700/80 dark:bg-slate-950/30">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-700/80">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Visit context</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {consultationTypeLabel}
                  <span className="text-slate-400"> · </span>
                  {canEdit ? (
                    <label htmlFor="consultation-os-status" className="sr-only">
                      Status
                    </label>
                  ) : null}
                  {canEdit ? (
                    <select
                      id="consultation-os-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ConsultationStatus)}
                      className="ml-1 max-w-[11rem] rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="draft">Draft</option>
                      <option value="in_progress">In progress</option>
                    </select>
                  ) : (
                    <FiStatusBadge tone={statusTone(status)} appearance="pill">
                      {formatStatusLabel(status)}
                    </FiStatusBadge>
                  )}
                </p>
              </div>
            </div>

            <div onBlurCapture={handleEditorBlurCapture} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ConsultationPatientLinkField
                  tenantId={tenantId}
                  disabled={!canEdit}
                  patientId={linkedPatientId}
                  patientLabel={linkedPatientLabel}
                  onLinkPatient={onLinkPatientHit}
                  onClearPatient={onClearPatient}
                />
                {showCrmNav ? (
                  <ConsultationLeadLinkField
                    tenantId={tenantId}
                    disabled={!canEdit}
                    leadId={linkedLeadId}
                    leadLabel={linkedLeadLabel}
                    leadStage={linkedLeadStage}
                    onLinkLead={onLinkLeadHit}
                    onClearLead={onClearLead}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200/90 p-3 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-400">
                    Lead linking requires CRM access.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="cos-hub-date" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </label>
                  <input
                    id="cos-hub-date"
                    type="date"
                    value={consultationDate}
                    onChange={(e) => setConsultationDate(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                {clinicalStaffOptions.length > 0 ? (
                  <div>
                    <label htmlFor="cos-hub-consultant-staff" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      Consultant
                    </label>
                    <StaffClinicalSelect
                      id="cos-hub-consultant-staff"
                      tenantId={tenantId}
                      options={clinicalStaffOptions}
                      value={consultantStaffId}
                      allowEmpty
                      emptyLabel="Select…"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      disabled={!canEdit}
                      onChange={(staffId) => {
                        setConsultantStaffId(staffId);
                        const picked = clinicalStaffOptions.find((s) => s.id === staffId);
                        if (picked) setConsultantName(picked.full_name?.trim() || picked.email?.trim() || "");
                        else if (!staffId) setConsultantName("");
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="cos-hub-consultant-name" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      Consultant
                    </label>
                    <input
                      id="cos-hub-consultant-name"
                      type="text"
                      value={consultantName}
                      onChange={(e) => setConsultantName(e.target.value)}
                      disabled={!canEdit}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
                <div className="min-w-0">
                  {canEdit ? (
                    <>
                      <p className="text-xs font-medium text-slate-500" aria-live="polite">
                        {subtleSaveLabel}
                      </p>
                      {autosaveWarning?.trim() && !error?.trim() ? (
                        <p className="mt-1 max-w-md text-xs text-amber-800 dark:text-amber-200/90" role="status">
                          Autosave: {autosaveWarning}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Intake is read-only for this status.</p>
                  )}
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void onSaveDraft()}
                    disabled={busySave}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busySave ? "Saving…" : "Save intake"}
                  </button>
                ) : null}
              </div>
            </div>
          </FiCard>
          </div>
        );
      case "checklist":
        return null;
      default: {
        const _exhaustive: never = sectionId;
        return _exhaustive;
      }
    }
  };

  return (
    <div className="space-y-5">
      <FiCard>
        <FiPageHeader
          titleId="consultation-os-heading"
          eyebrow="ConsultationOS"
          title="Consultation hub"
          description="Intelligence workflow: structured pathways produce the clinical record and, when completed, a consultation intelligence summary plus routing into SurgeryOS, RevenueOS, HairAudit, and Twin-aligned follow-up."
          secondaryAction={
            <div className="flex flex-wrap gap-2">
              {appointmentHref ? (
                <Link
                  href={appointmentHref}
                  className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
                >
                  Open appointment
                </Link>
              ) : null}
              <Link
                href={patientsHref}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
              >
                Back to patients
              </Link>
            </div>
          }
        />
      </FiCard>

      <FiCard className="border-sky-100 bg-gradient-to-r from-sky-50/80 to-white dark:border-sky-900/40 dark:from-sky-950/30 dark:to-slate-950/40">
        <p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
          <span className="font-semibold text-sky-900 dark:text-sky-200">How this hub works.</span>{" "}
          {!hubPlan.hasPathwayCompletionSummary
            ? "Choose a pathway below to open the guided form. When you complete and approve that form, this page will surface the intelligence summary and downstream routing."
            : "Your pathway is complete — review the intelligence summary and routing first, then open another pathway if this visit needs an additional structured capture."}
        </p>
      </FiCard>

      {!hubPlan.hasPathwayCompletionSummary ? pathwayLauncherEl : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      {saveOk ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
          Intake saved successfully.
        </div>
      ) : null}

      <FiCard className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optional break-glass access</p>
        <label htmlFor="cos-admin-key" className="block text-xs text-slate-600">
          FI Admin API key (only if your account does not have CRM write access)
        </label>
        <input
          id="cos-admin-key"
          type="password"
          autoComplete="off"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none ring-sky-400/20 focus-visible:border-sky-300 focus-visible:ring-2"
        />
      </FiCard>

      {hubPlan.hasPathwayCompletionSummary
        ? hubPlan.orderedSections.map((id) => renderHubSection(id))
        : renderHubSection("intake")}

      {linkedPatientId?.trim() ? (
        <ConsultationPreparationChecklistPanel
          checklist={initialConsultationChecklistPreview}
          patientTwinHref={`${base}/patients/${linkedPatientId.trim()}/twin`}
        />
      ) : null}
    </div>
  );
}
