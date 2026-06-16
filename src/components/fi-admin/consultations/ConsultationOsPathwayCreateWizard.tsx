"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { createConsultationDraftAction } from "@/lib/actions/fi-consultation-actions";
import { ConsultationLeadLinkField } from "@/src/components/fi-admin/consultations/ConsultationLeadLinkField";
import { ConsultationPatientLinkField } from "@/src/components/fi-admin/consultations/ConsultationPatientLinkField";
import { StaffClinicalSelect } from "@/src/components/fi/staff/StaffClinicalPickerFields";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiSection } from "@/src/components/fi-design/FiSection";
import type { ConsultationLinkSearchLeadHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import type { ConsultationLinkSearchPatientHit } from "@/src/lib/consultations/consultationLinkSearchLoader.server";
import type { ConsultationPathwayLauncherPathKey } from "@/src/lib/consultations/consultationPathwayKeys";
import {
  consultationPathwayCreateCards,
  consultationPathwayFormHref,
  PATHWAY_DEFAULT_CONSULTATION_TYPE,
  type ConsultationPathwayCreateCard,
} from "@/src/lib/consultations/consultationPathwayRouting";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";

type Step = 1 | 2;

export function ConsultationOsPathwayCreateWizard({
  tenantId,
  showCrmNav,
  clinicalStaffOptions = [],
  operationalTodayYmd,
}: {
  tenantId: string;
  showCrmNav: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
  operationalTodayYmd: string;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId.trim()}`;
  const patientsHref = `${base}/patients`;

  const [step, setStep] = useState<Step>(1);
  const [adminKey, setAdminKey] = useState("");
  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const [consultantName, setConsultantName] = useState("");
  const [consultantStaffId, setConsultantStaffId] = useState("");
  const [consultationDate, setConsultationDate] = useState(() => operationalTodayYmd);

  const [linkedPatientId, setLinkedPatientId] = useState<string | null>(null);
  const [linkedPersonId, setLinkedPersonId] = useState<string | null>(null);
  const [linkedLeadId, setLinkedLeadId] = useState<string | null>(null);
  const [linkedPatientLabel, setLinkedPatientLabel] = useState<string | null>(null);
  const [linkedLeadLabel, setLinkedLeadLabel] = useState<string | null>(null);
  const [linkedLeadStage, setLinkedLeadStage] = useState<string | null>(null);

  const [selectedPathway, setSelectedPathway] = useState<ConsultationPathwayLauncherPathKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cards = useMemo(() => consultationPathwayCreateCards(), []);

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

  const onStartPathway = useCallback(async () => {
    if (!selectedPathway) {
      setError("Choose a consultation pathway.");
      return;
    }
    const pathKey = selectedPathway;
    setError(null);
    setBusy(true);
    try {
      const consultation_type = PATHWAY_DEFAULT_CONSULTATION_TYPE[pathKey];
      const body: Record<string, unknown> = {
        consultation_type,
        consultant_name: consultantName.trim() === "" ? null : consultantName.trim(),
        consultation_date: consultationDate.trim() === "" ? null : consultationDate.trim(),
      };
      if (consultantStaffId.trim()) body.consultant_staff_id = consultantStaffId.trim();
      if (linkedPatientId?.trim()) body.patient_id = linkedPatientId.trim();
      else if (linkedPersonId?.trim()) body.person_id = linkedPersonId.trim();
      if (linkedLeadId?.trim()) body.lead_id = linkedLeadId.trim();

      const res = await createConsultationDraftAction(tenantId, withAdmin(body));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const href = consultationPathwayFormHref({
        tenantId,
        consultationId: res.consultationId,
        pathKey,
      });
      router.push(href);
    } finally {
      setBusy(false);
    }
  }, [
    tenantId,
    selectedPathway,
    consultantName,
    consultationDate,
    consultantStaffId,
    linkedPatientId,
    linkedPersonId,
    linkedLeadId,
    withAdmin,
    router,
  ]);

  return (
    <div className="space-y-5">
      <FiCard>
        <FiPageHeader
          titleId="consultation-os-new-heading"
          eyebrow="ConsultationOS"
          title="New consultation"
          description="Pathway-first intake: capture visit context, choose the clinical pathway, then open the structured form. Legacy free-form panels are retired — clinical detail lives in the pathway."
          secondaryAction={
            <Link
              href={patientsHref}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2"
            >
              Back to patients
            </Link>
          }
        />
      </FiCard>

      <FiCard className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optional break-glass access</p>
        <label htmlFor="cos-new-admin-key" className="block text-xs text-slate-600">
          FI Admin API key (only if your account does not have CRM write access)
        </label>
        <input
          id="cos-new-admin-key"
          type="password"
          autoComplete="off"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none ring-sky-400/20 focus-visible:border-sky-300 focus-visible:ring-2"
        />
      </FiCard>

      <nav aria-label="Consultation steps" className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            step === 1 ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          Step 1 · Intake
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            step === 2 ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-700"
          }`}
        >
          Step 2 · Pathway
        </button>
      </nav>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <FiCard>
          <FiSection
            title="Consultation intake"
            description="Link anchors for this visit, then continue to pathway selection."
            headingId="consultation-os-intake-heading"
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <ConsultationPatientLinkField
                tenantId={tenantId}
                disabled={false}
                patientId={linkedPatientId}
                patientLabel={linkedPatientLabel}
                onLinkPatient={onLinkPatientHit}
                onClearPatient={onClearPatient}
              />
              {showCrmNav ? (
                <ConsultationLeadLinkField
                  tenantId={tenantId}
                  disabled={false}
                  leadId={linkedLeadId}
                  leadLabel={linkedLeadLabel}
                  leadStage={linkedLeadStage}
                  onLinkLead={onLinkLeadHit}
                  onClearLead={onClearLead}
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead (optional)</p>
                  <p className="text-sm text-slate-600">CRM lead linking requires Sales (CRM) access for this user.</p>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <div>
                <label htmlFor="cos-new-date" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Consultation date
                </label>
                <input
                  id="cos-new-date"
                  type="date"
                  value={consultationDate}
                  onChange={(e) => setConsultationDate(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
                />
              </div>
              {clinicalStaffOptions.length > 0 ? (
                <div>
                  <label htmlFor="cos-new-consultant-staff" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Consultant
                  </label>
                  <StaffClinicalSelect
                    id="cos-new-consultant-staff"
                    tenantId={tenantId}
                    options={clinicalStaffOptions}
                    value={consultantStaffId}
                    allowEmpty
                    emptyLabel="Select consultant…"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
                    disabled={false}
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
                  <label htmlFor="cos-new-consultant-name" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Consultant
                  </label>
                  <input
                    id="cos-new-consultant-name"
                    type="text"
                    value={consultantName}
                    onChange={(e) => setConsultantName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
                    placeholder="Consultant name"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(2);
                }}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2"
              >
                Continue to pathway selection
              </button>
            </div>
          </FiSection>
        </FiCard>
      ) : (
        <FiCard className="space-y-4">
          <FiSection
            title="Pathway selection"
            description="Pick the structured intake that matches this visit. You will jump straight into the guided form — there is no legacy consultation workspace."
            headingId="consultation-os-pathway-pick-heading"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {cards.map((c: ConsultationPathwayCreateCard) => {
                const active = selectedPathway === c.pathKey;
                return (
                  <button
                    key={c.pathKey}
                    type="button"
                    onClick={() => {
                      setSelectedPathway(c.pathKey);
                      setError(null);
                    }}
                    className={`flex flex-col rounded-xl border p-4 text-left shadow-sm transition ${
                      active
                        ? "border-sky-400 bg-sky-50/90 ring-2 ring-sky-300/60 dark:border-sky-600 dark:bg-sky-950/40 dark:ring-sky-800"
                        : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40"
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{c.title}</span>
                    <span className="mt-2 text-xs leading-snug text-slate-600 dark:text-slate-400">{c.subtitle}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
              >
                ← Back to intake
              </button>
              <button
                type="button"
                onClick={() => void onStartPathway()}
                disabled={busy || !selectedPathway}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Starting…" : "Start pathway form"}
              </button>
            </div>
          </FiSection>
        </FiCard>
      )}
    </div>
  );
}
