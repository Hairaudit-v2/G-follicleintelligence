"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  CONSULTATION_TYPE_DEFINITIONS,
  DEFAULT_CONSULTATION_TYPE_ID,
  type ConsultationSectionId,
  type ConsultationTypeId,
  getConsultationTypeDefinition,
  parseConsultationTypeId,
} from "@/src/lib/consultations/consultationTypeConfig";

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
import { LabeledDisabledInput } from "@/src/components/fi-admin/consultations/consultationOsPreviewFields";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiSection } from "@/src/components/fi-design/FiSection";
import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";

type ConsultationOsNewPageProps = {
  tenantId: string;
};

type ConsultationMainSectionId = Exclude<ConsultationSectionId, "quote">;

function renderMainSection(sectionId: ConsultationMainSectionId) {
  switch (sectionId) {
    case "assessment":
      return <ConsultationOsAssessmentPanel />;
    case "donor":
      return <ConsultationOsDonorPanel />;
    case "medical":
      return <ConsultationOsMedicalPanel />;
    case "recommendations":
      return <ConsultationOsRecommendationsPanel />;
    case "brow_design":
      return <ConsultationOsBrowDesignPanel />;
    case "beard_design":
      return <ConsultationOsBeardDesignPanel />;
    case "body_hair":
      return <ConsultationOsBodyHairPanel />;
    case "regenerative_assessment":
      return <ConsultationOsRegenerativeAssessmentPanel />;
    case "medical_hair_loss":
      return <ConsultationOsMedicalHairLossPanel />;
    default: {
      const _exhaustive: never = sectionId;
      return _exhaustive;
    }
  }
}

/**
 * ConsultationOS “new consultation” workspace — UI preview only (no persistence, save, or submit).
 */
export function ConsultationOsNewPage({ tenantId }: ConsultationOsNewPageProps) {
  const base = `/fi-admin/${tenantId.trim()}`;
  const patientsHref = `${base}/patients`;

  const [consultationTypeId, setConsultationTypeId] = useState<ConsultationTypeId>(DEFAULT_CONSULTATION_TYPE_ID);
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

  return (
    <div className="space-y-5">
      <p id="consultation-os-preview-aria" className="sr-only">
        Preview-only consultation workspace. Form fields are disabled; there is no save, submit, or server sync.
      </p>

      <FiCard>
        <FiPageHeader
          titleId="consultation-os-new-heading"
          eyebrow="ConsultationOS"
          title="New consultation"
          description="Capture clinical notes, treatment planning and quote information in one structured workspace."
          primaryAction={
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 shadow-none"
              title="Preview workspace — not actionable yet"
            >
              Preview only
            </button>
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
        aria-describedby="consultation-os-preview-aria"
      >
        <strong className="font-semibold">Preview only.</strong> This workspace is not connected to patient records
        yet — all fields are disabled placeholders with no save, autosave, or AI in this stage.
      </div>

      <FiCard className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="consultation-os-type" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Consultation type
            </label>
            <select
              id="consultation-os-type"
              value={consultationTypeId}
              onChange={(e) => {
                const next = parseConsultationTypeId(e.target.value);
                if (next) setConsultationTypeId(next);
              }}
              className="mt-1.5 w-full max-w-xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none ring-sky-400/25 focus-visible:border-sky-300 focus-visible:ring-2 sm:w-auto sm:min-w-[20rem]"
            >
              {CONSULTATION_TYPE_DEFINITIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">
          Changing consultation type only changes this preview layout. No data is saved yet.
        </p>
      </FiCard>

      <FiSection
        title="Consultation summary"
        description="Placeholder fields for a future patient link"
        headingId="consultation-os-summary-heading"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <LabeledDisabledInput id="cos-sum-name" label="Patient name" />
          <LabeledDisabledInput id="cos-sum-dob" label="DOB" />
          <LabeledDisabledInput id="cos-sum-referral" label="Referral source" />
          <LabeledDisabledInput id="cos-sum-consultant" label="Consultant" />
          <LabeledDisabledInput id="cos-sum-date" label="Consultation date" />
          <div>
            <p className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
            <div className="flex min-h-[42px] items-center">
              <FiStatusBadge tone="neutral">Draft</FiStatusBadge>
            </div>
          </div>
        </div>
      </FiSection>

      <div
        className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6"
        aria-describedby="consultation-os-preview-aria"
        key={consultationTypeId}
      >
        <div className="space-y-5 lg:col-span-7">
          {leftSectionIds.map((sectionId) => (
            <div key={sectionId}>{renderMainSection(sectionId)}</div>
          ))}
        </div>
        <div className="space-y-5 lg:col-span-5">
          <ConsultationOsNotesPanel
            key={`notes-${consultationTypeId}`}
            notesPlaceholder={notesPlaceholder}
            promptFocus={[...definition.promptFocus]}
          />
          {showQuote ? <ConsultationOsQuotePanel /> : null}
        </div>
      </div>
    </div>
  );
}
