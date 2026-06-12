import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";

export function PatientImportedSourceSection({ data }: { data: PatientProfileFoundationData }) {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  const hasSource =
    idc.hasHubspotSlice ||
    Boolean(idc.importBatchId) ||
    Boolean(idc.hubspotRecordId) ||
    Boolean(idc.lifecycleStage) ||
    Boolean(idc.leadStatus) ||
    Boolean(idc.stageOfJourney);

  if (!hasSource) return null;

  const items: { label: string; value: string }[] = [];
  if (idc.hubspotRecordId) items.push({ label: "HubSpot record ID", value: idc.hubspotRecordId });
  if (idc.importBatchId) items.push({ label: "Import batch", value: idc.importBatchId });
  if (idc.lifecycleStage) items.push({ label: "Lifecycle stage", value: idc.lifecycleStage });
  if (idc.leadStatus) items.push({ label: "Lead status", value: idc.leadStatus });
  if (idc.stageOfJourney) items.push({ label: "Stage of journey", value: idc.stageOfJourney });

  return (
    <details className="rounded border border-slate-200 bg-slate-50/80 text-sm text-slate-800">
      <summary className="cursor-pointer select-none px-4 py-3 font-medium text-slate-700 outline-none hover:bg-slate-100/80">
        Source details
        {idc.hasHubspotSlice ? (
          <span className="ml-2 rounded bg-slate-200/90 px-2 py-0.5 text-xs font-normal text-slate-700">HubSpot</span>
        ) : null}
      </summary>
      <div className="border-t border-slate-200 px-4 pb-4 pt-2">
        <p className="mb-3 text-xs text-slate-600">
          Values below come from normalised import metadata on the person/patient records. Raw JSON is not shown here.
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-slate-600">No additional source fields to list.</p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2">
            {items.map((r) => (
              <div key={r.label}>
                <dt className="text-xs text-slate-500">{r.label}</dt>
                <dd className="break-words font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </details>
  );
}
