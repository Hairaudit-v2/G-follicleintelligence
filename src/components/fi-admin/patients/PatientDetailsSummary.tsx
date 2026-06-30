"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import {
  pwsCard,
  pwsCardPad,
  pwsDivider,
  pwsLabel,
  pwsValue,
  pwsMeta,
} from "./patientWorkspaceStyles";

function fmtConsent(v: boolean | null): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function fmtPreferred(m: string | null): string {
  if (!m) return "—";
  if (m === "both") return "Email & SMS";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className={pwsLabel}>{label}</dt>
      <dd className={`mt-0.5 break-words ${pwsValue}`}>{value}</dd>
    </div>
  );
}

export function PatientDetailsSummary({ data }: { data: PatientProfileFoundationData }) {
  const [expanded, setExpanded] = useState(false);

  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  const primaryFields = [
    { label: "Email", value: idc.primaryEmail ?? "—" },
    { label: "Phone", value: idc.primaryPhone ?? "—" },
    { label: "Date of birth", value: idc.dateOfBirth ?? "—" },
    { label: "Preferred contact", value: fmtPreferred(idc.preferredContactMethod) },
    { label: "Reminder consent", value: fmtConsent(idc.reminderConsent) },
  ];

  const expandedFields = [
    { label: "Full name", value: idc.fullName },
    { label: "Preferred / display name", value: idc.preferredDisplayName ?? "—" },
    { label: "Age", value: idc.ageYears != null ? `${idc.ageYears} years` : "—" },
    { label: "Address", value: idc.address ?? "—" },
  ];

  const hasHubspotSlice = idc.hasHubspotSlice;
  const sourceItems: { label: string; value: string }[] = [];
  if (idc.hubspotRecordId)
    sourceItems.push({ label: "HubSpot record ID", value: idc.hubspotRecordId });
  if (idc.importBatchId) sourceItems.push({ label: "Import batch", value: idc.importBatchId });
  if (idc.lifecycleStage) sourceItems.push({ label: "Lifecycle stage", value: idc.lifecycleStage });
  if (idc.leadStatus) sourceItems.push({ label: "Lead status", value: idc.leadStatus });
  if (idc.stageOfJourney)
    sourceItems.push({ label: "Stage of journey", value: idc.stageOfJourney });
  const hasSourceDetails = hasHubspotSlice || sourceItems.length > 0;

  return (
    <section
      className={`${pwsCard} ${pwsCardPad}`}
      aria-labelledby="patient-details-summary-heading"
    >
      <div className="flex items-center justify-between">
        <h2 id="patient-details-summary-heading" className="text-sm font-semibold text-slate-100">
          Patient details
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-300"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </>
          ) : (
            <>
              More details <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </>
          )}
        </button>
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {primaryFields.map((f) => (
          <Field key={f.label} label={f.label} value={f.value} />
        ))}
      </dl>

      {expanded && (
        <div className={`mt-4 space-y-4 ${pwsDivider} pt-4`}>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {expandedFields.map((f) => (
              <Field key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>

          {hasSourceDetails && (
            <div>
              <p className={`mb-2 ${pwsMeta} font-medium text-slate-400`}>
                Source details
                {hasHubspotSlice && (
                  <span className="ml-2 rounded border border-white/[0.08] bg-white/[0.06] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">
                    HubSpot
                  </span>
                )}
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {sourceItems.map((r) => (
                  <Field key={r.label} label={r.label} value={r.value} />
                ))}
                {sourceItems.length === 0 && (
                  <p className="text-xs text-slate-500">No additional source fields.</p>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
