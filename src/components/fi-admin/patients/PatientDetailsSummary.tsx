"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";

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
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="break-words text-sm text-gray-900">{value}</dd>
    </div>
  );
}

export function PatientDetailsSummary({
  data,
}: {
  data: PatientProfileFoundationData;
}) {
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
  if (idc.hubspotRecordId) sourceItems.push({ label: "HubSpot record ID", value: idc.hubspotRecordId });
  if (idc.importBatchId) sourceItems.push({ label: "Import batch", value: idc.importBatchId });
  if (idc.lifecycleStage) sourceItems.push({ label: "Lifecycle stage", value: idc.lifecycleStage });
  if (idc.leadStatus) sourceItems.push({ label: "Lead status", value: idc.leadStatus });
  if (idc.stageOfJourney) sourceItems.push({ label: "Stage of journey", value: idc.stageOfJourney });
  const hasSourceDetails = hasHubspotSlice || sourceItems.length > 0;

  return (
    <section
      className="rounded border border-gray-200 bg-white p-4 shadow-sm"
      aria-labelledby="patient-details-summary-heading"
    >
      <div className="flex items-center justify-between">
        <h2 id="patient-details-summary-heading" className="text-sm font-semibold text-gray-900">
          Patient details
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
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
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {expandedFields.map((f) => (
              <Field key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>

          {hasSourceDetails && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">
                Source details
                {hasHubspotSlice && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                    HubSpot
                  </span>
                )}
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {sourceItems.map((r) => (
                  <Field key={r.label} label={r.label} value={r.value} />
                ))}
                {sourceItems.length === 0 && (
                  <p className="text-xs text-gray-500">No additional source fields.</p>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
