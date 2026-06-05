"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createConsultationDraftAction, updateConsultationDraftAction } from "@/lib/actions/fi-consultation-actions";
import { ConsultationOsAssessmentPanel } from "@/src/components/fi-admin/consultations/ConsultationOsAssessmentPanel";
import { ConsultationOsBeardDesignPanel } from "@/src/components/fi-admin/consultations/ConsultationOsBeardDesignPanel";
import { ConsultationOsBodyHairPanel } from "@/src/components/fi-admin/consultations/ConsultationOsBodyHairPanel";
import { ConsultationOsBrowDesignPanel } from "@/src/components/fi-admin/consultations/ConsultationOsBrowDesignPanel";
import { ConsultationOsDonorPanel } from "@/src/components/fi-admin/consultations/ConsultationOsDonorPanel";
import { ConsultationOsMedicalHairLossPanel } from "@/src/components/fi-admin/consultations/ConsultationOsMedicalHairLossPanel";
import { ConsultationOsMedicalPanel } from "@/src/components/fi-admin/consultations/ConsultationOsMedicalPanel";
import { ConsultationOsNotesPanel } from "@/src/components/fi-admin/consultations/ConsultationOsNotesPanel";
import { ConsultationOsQuotePanel } from "@/src/components/fi-admin/consultations/ConsultationOsQuotePanel";
import { ConsultationOsRecommendationsPanel } from "@/src/components/fi-admin/consultations/ConsultationOsRecommendationsPanel";
import { ConsultationOsRegenerativeAssessmentPanel } from "@/src/components/fi-admin/consultations/ConsultationOsRegenerativeAssessmentPanel";
import { LabeledTextInput, LabeledTextarea } from "@/src/components/fi-admin/consultations/consultationOsPreviewFields";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiSection } from "@/src/components/fi-design/FiSection";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import {
  CONSULTATION_TYPE_DEFINITIONS,
  DEFAULT_CONSULTATION_TYPE_ID,
  type ConsultationSectionId,
  type ConsultationTypeId,
  getConsultationTypeDefinition,
  parseConsultationTypeId,
} from "@/src/lib/consultations/consultationTypeConfig";
import {
  CONSULTATION_EDITABLE_STATUSES,
  CONSULTATION_QUOTE_DATA_KEYS,
  CONSULTATION_STRUCTURED_SECTION_KEYS,
  type ConsultationQuoteDataKey,
  type ConsultationRow,
  type ConsultationStatus,
  type ConsultationStructuredSectionKey,
} from "@/src/lib/consultations/consultationTypes";

type ConsultationMainSectionId = Exclude<ConsultationSectionId, "quote">;

function sectionRecordFromUnknown(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") o[k] = v;
    else if (v != null && (typeof v === "number" || typeof v === "boolean")) o[k] = String(v);
  }
  return o;
}

function emptyStructured(): Record<ConsultationStructuredSectionKey, Record<string, string>> {
  return Object.fromEntries(CONSULTATION_STRUCTURED_SECTION_KEYS.map((k) => [k, {}])) as Record<
    ConsultationStructuredSectionKey,
    Record<string, string>
  >;
}

function initStructuredFromRow(structured: Record<string, unknown>): Record<ConsultationStructuredSectionKey, Record<string, string>> {
  const out = emptyStructured();
  for (const k of CONSULTATION_STRUCTURED_SECTION_KEYS) {
    out[k] = sectionRecordFromUnknown(structured[k]);
  }
  return out;
}

function emptyQuote(): Record<ConsultationQuoteDataKey, string> {
  return Object.fromEntries(CONSULTATION_QUOTE_DATA_KEYS.map((k) => [k, ""])) as Record<ConsultationQuoteDataKey, string>;
}

function initQuoteFromRow(raw: Record<string, unknown>): Record<ConsultationQuoteDataKey, string> {
  const o = emptyQuote();
  for (const k of CONSULTATION_QUOTE_DATA_KEYS) {
    const v = raw[k];
    o[k] = typeof v === "string" ? v : v != null ? String(v) : "";
  }
  return o;
}

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
  mode: "create" | "edit";
  consultationId?: string;
  initialRow?: ConsultationRow | null;
};

function renderMainSection(
  sectionId: ConsultationMainSectionId,
  bind: (id: ConsultationStructuredSectionKey) => {
    values: Record<string, string>;
    onFieldChange: (fieldKey: string, value: string) => void;
    disabled?: boolean;
  }
) {
  const b = bind(sectionId);
  switch (sectionId) {
    case "assessment":
      return <ConsultationOsAssessmentPanel {...b} />;
    case "donor":
      return <ConsultationOsDonorPanel {...b} />;
    case "medical":
      return <ConsultationOsMedicalPanel {...b} />;
    case "recommendations":
      return <ConsultationOsRecommendationsPanel {...b} />;
    case "brow_design":
      return <ConsultationOsBrowDesignPanel {...b} />;
    case "beard_design":
      return <ConsultationOsBeardDesignPanel {...b} />;
    case "body_hair":
      return <ConsultationOsBodyHairPanel {...b} />;
    case "regenerative_assessment":
      return <ConsultationOsRegenerativeAssessmentPanel {...b} />;
    case "medical_hair_loss":
      return <ConsultationOsMedicalHairLossPanel {...b} />;
    default: {
      const _exhaustive: never = sectionId;
      return _exhaustive;
    }
  }
}

export function ConsultationOsWorkspace({ tenantId, mode, consultationId, initialRow }: ConsultationOsWorkspaceProps) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId.trim()}`;
  const patientsHref = `${base}/patients`;

  const [adminKey, setAdminKey] = useState("");
  const withAdmin = useCallback(
    <T extends Record<string, unknown>>(body: T): T & { adminKey?: string } => {
      const k = adminKey.trim();
      return k ? { ...body, adminKey: k } : body;
    },
    [adminKey]
  );

  const [consultationTypeId, setConsultationTypeId] = useState<ConsultationTypeId>(
    mode === "edit" && initialRow ? (initialRow.consultation_type as ConsultationTypeId) : DEFAULT_CONSULTATION_TYPE_ID
  );
  const [status, setStatus] = useState<ConsultationStatus>(
    mode === "edit" && initialRow ? initialRow.status : "draft"
  );
  const [consultantName, setConsultantName] = useState(mode === "edit" && initialRow ? initialRow.consultant_name ?? "" : "");
  const [consultationDate, setConsultationDate] = useState(
    mode === "edit" && initialRow ? initialRow.consultation_date ?? "" : ""
  );
  const [structuredData, setStructuredData] = useState<Record<ConsultationStructuredSectionKey, Record<string, string>>>(() =>
    mode === "edit" && initialRow ? initStructuredFromRow(initialRow.structured_data) : emptyStructured()
  );
  const [liveNotes, setLiveNotes] = useState(mode === "edit" && initialRow ? initialRow.live_notes ?? "" : "");
  const [recommendationNotes, setRecommendationNotes] = useState(
    mode === "edit" && initialRow ? initialRow.recommendation_notes ?? "" : ""
  );
  const [quoteData, setQuoteData] = useState<Record<ConsultationQuoteDataKey, string>>(() =>
    mode === "edit" && initialRow ? initQuoteFromRow(initialRow.quote_data) : emptyQuote()
  );

  const [busyCreate, setBusyCreate] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const definition = useMemo(() => getConsultationTypeDefinition(consultationTypeId), [consultationTypeId]);
  const leftSectionIds = useMemo(
    () => definition.sections.filter((s): s is ConsultationMainSectionId => s !== "quote"),
    [definition.sections]
  );
  const showQuote = definition.sections.includes("quote");

  const notesPlaceholder = useMemo(() => {
    const focus = definition.promptFocus;
    if (focus.length === 0) return "Type live consultation notes here…";
    return `Type live consultation notes here… (e.g. ${focus.slice(0, 3).join(", ")}${focus.length > 3 ? "…" : ""})`;
  }, [definition.promptFocus]);

  const canEdit = useMemo(() => {
    if (mode === "create") return true;
    return (CONSULTATION_EDITABLE_STATUSES as readonly string[]).includes(status);
  }, [mode, status]);

  const sectionBind = useCallback(
    (sectionId: ConsultationStructuredSectionKey) => ({
      values: structuredData[sectionId] ?? {},
      onFieldChange: (fieldKey: string, value: string) => {
        setStructuredData((prev) => ({
          ...prev,
          [sectionId]: { ...(prev[sectionId] ?? {}), [fieldKey]: value },
        }));
      },
      disabled: !canEdit,
    }),
    [structuredData, canEdit]
  );

  const onQuoteFieldChange = useCallback(
    (key: ConsultationQuoteDataKey, value: string) => {
      setQuoteData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const buildPayload = useCallback(() => {
    const structuredPayload: Record<string, unknown> = {};
    for (const k of CONSULTATION_STRUCTURED_SECTION_KEYS) {
      structuredPayload[k] = structuredData[k] ?? {};
    }
    const quotePayload: Record<string, unknown> = {};
    for (const k of CONSULTATION_QUOTE_DATA_KEYS) {
      quotePayload[k] = quoteData[k] ?? "";
    }
    return {
      consultation_type: consultationTypeId,
      status,
      consultant_name: consultantName.trim() === "" ? null : consultantName.trim(),
      consultation_date: consultationDate.trim() === "" ? null : consultationDate.trim(),
      structured_data: structuredPayload,
      live_notes: liveNotes.trim() === "" ? null : liveNotes,
      recommendation_notes: recommendationNotes.trim() === "" ? null : recommendationNotes,
      quote_data: quotePayload,
    };
  }, [
    consultationTypeId,
    status,
    consultantName,
    consultationDate,
    structuredData,
    liveNotes,
    recommendationNotes,
    quoteData,
  ]);

  const onCreateDraft = useCallback(async () => {
    setError(null);
    setSaveOk(false);
    setBusyCreate(true);
    try {
      const res = await createConsultationDraftAction(
        tenantId,
        withAdmin({ consultation_type: consultationTypeId })
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`${base}/consultations/${res.consultationId}`);
    } finally {
      setBusyCreate(false);
    }
  }, [tenantId, consultationTypeId, withAdmin, router, base]);

  const onSaveDraft = useCallback(async () => {
    if (mode !== "edit" || !consultationId?.trim()) return;
    setError(null);
    setSaveOk(false);
    setBusySave(true);
    try {
      const res = await updateConsultationDraftAction(tenantId, consultationId.trim(), withAdmin(buildPayload()));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaveOk(true);
      router.refresh();
    } finally {
      setBusySave(false);
    }
  }, [mode, consultationId, tenantId, withAdmin, buildPayload, router]);

  const headerTitle = mode === "create" ? "New consultation" : "Consultation workspace";
  const headerDescription =
    mode === "create"
      ? "Early ConsultationOS workflow: choose a type, capture notes in the panels, then create a server-backed draft."
      : "Early ConsultationOS workflow: edit fields locally and use Save draft to persist (manual save only).";

  return (
    <div className="space-y-5">
      <FiCard>
        <FiPageHeader
          titleId="consultation-os-heading"
          eyebrow="ConsultationOS"
          title={headerTitle}
          description={headerDescription}
          primaryAction={
            mode === "create" ? (
              <button
                type="button"
                onClick={() => void onCreateDraft()}
                disabled={busyCreate}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyCreate ? "Creating…" : "Create draft consultation"}
              </button>
            ) : canEdit ? (
              <button
                type="button"
                onClick={() => void onSaveDraft()}
                disabled={busySave}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busySave ? "Saving…" : "Save draft"}
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-500">Read-only (not draft / in progress)</span>
            )
          }
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

      <div
        role="status"
        className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Early workflow.</strong> ConsultationOS is under active development. There is
        no autosave, AI summary, voice dictation, quote automation, case conversion, or calendar integration in this stage.
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      {saveOk ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
          Draft saved successfully.
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
          className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-sky-400/20 focus-visible:border-sky-300 focus-visible:ring-2"
        />
      </FiCard>

      <FiCard className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="consultation-os-type" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Consultation type
            </label>
            <select
              id="consultation-os-type"
              value={consultationTypeId}
              disabled={!canEdit}
              onChange={(e) => {
                const next = parseConsultationTypeId(e.target.value);
                if (next) setConsultationTypeId(next);
              }}
              className="mt-1.5 w-full max-w-xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none ring-sky-400/25 focus-visible:border-sky-300 focus-visible:ring-2 sm:w-auto sm:min-w-[20rem] disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {CONSULTATION_TYPE_DEFINITIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {mode === "edit" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              {canEdit ? (
                <select
                  id="consultation-os-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ConsultationStatus)}
                  className="mt-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
                >
                  <option value="draft">Draft</option>
                  <option value="in_progress">In progress</option>
                </select>
              ) : (
                <div className="mt-1.5 flex min-h-[42px] items-center">
                  <FiStatusBadge tone={statusTone(status)}>{formatStatusLabel(status)}</FiStatusBadge>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </FiCard>

      <FiSection
        title="Consultation summary"
        description="Placeholder-friendly summary fields (not yet linked to a patient record)."
        headingId="consultation-os-summary-heading"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LabeledTextInput
            id="cos-sum-name"
            label="Patient name"
            value={structuredData.summary?.patient_name ?? ""}
            onChange={(v) =>
              setStructuredData((p) => ({
                ...p,
                summary: { ...(p.summary ?? {}), patient_name: v },
              }))
            }
            disabled={!canEdit}
          />
          <LabeledTextInput
            id="cos-sum-dob"
            label="DOB"
            value={structuredData.summary?.date_of_birth ?? ""}
            onChange={(v) =>
              setStructuredData((p) => ({
                ...p,
                summary: { ...(p.summary ?? {}), date_of_birth: v },
              }))
            }
            disabled={!canEdit}
          />
          <LabeledTextInput
            id="cos-sum-referral"
            label="Referral source"
            value={structuredData.summary?.referral_source ?? ""}
            onChange={(v) =>
              setStructuredData((p) => ({
                ...p,
                summary: { ...(p.summary ?? {}), referral_source: v },
              }))
            }
            disabled={!canEdit}
          />
          <LabeledTextInput
            id="cos-sum-consultant"
            label="Consultant"
            value={consultantName}
            onChange={setConsultantName}
            disabled={!canEdit}
          />
          <div>
            <label htmlFor="cos-sum-date" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Consultation date
            </label>
            <input
              id="cos-sum-date"
              type="date"
              value={consultationDate}
              onChange={(e) => setConsultationDate(e.target.value)}
              disabled={!canEdit}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>
          {mode === "create" ? (
            <div>
              <p className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
              <div className="flex min-h-[42px] items-center">
                <FiStatusBadge tone="neutral">Draft</FiStatusBadge>
              </div>
            </div>
          ) : null}
        </div>
      </FiSection>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6" key={consultationTypeId}>
        <div className="space-y-5 lg:col-span-7">
          {leftSectionIds.map((sectionId) => (
            <div key={sectionId}>{renderMainSection(sectionId, sectionBind)}</div>
          ))}
        </div>
        <div className="space-y-5 lg:col-span-5">
          <ConsultationOsNotesPanel
            key={`notes-${consultationTypeId}`}
            notesPlaceholder={notesPlaceholder}
            promptFocus={[...definition.promptFocus]}
            liveNotes={liveNotes}
            onLiveNotesChange={setLiveNotes}
            disabled={!canEdit}
          />
          <FiSection title="Recommendation notes" headingId="consultation-os-rec-notes-heading">
            <LabeledTextarea
              id="cos-recommendation-notes"
              label="Written recommendations"
              value={recommendationNotes}
              onChange={setRecommendationNotes}
              placeholder="Summarise advice, follow-up, and treatment intent…"
              rows={6}
              disabled={!canEdit}
            />
          </FiSection>
          {showQuote ? (
            <ConsultationOsQuotePanel values={quoteData} onFieldChange={onQuoteFieldChange} disabled={!canEdit} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
