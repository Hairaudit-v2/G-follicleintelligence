import Link from "next/link";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { PatientActivityCard } from "./PatientActivityCard";
import { PatientAdminNotesCard } from "./PatientAdminNotesCard";
import { PatientBookingsCard } from "./PatientBookingsCard";
import { PatientCasesCard } from "./PatientCasesCard";
import { PatientImagesCard } from "@/src/components/fi/patient-images/PatientImagesCard";
import { PatientClinicalDetailsCard } from "./PatientClinicalDetailsCard";
import { PatientLinkedLeadsCard } from "./PatientLinkedLeadsCard";
import { PatientContactDetailsCard } from "./PatientContactDetailsCard";
import { PatientImportedSourceSection } from "./PatientImportedSourceSection";
import { PatientPersonDetailsCard } from "./PatientPersonDetailsCard";
import { PatientProfileHeader } from "./PatientProfileHeader";
import { PatientProfileSummaryCards } from "./PatientProfileSummaryCards";
import { PatientTreatmentTimelineCard } from "./timeline/PatientTreatmentTimelineCard";

export function PatientProfilePage({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="text-sm text-gray-600">
        <Link href={`/fi-admin/${tenantId}/patients`} className="text-blue-600 hover:underline">
          ← Patients
        </Link>
        <span className="mx-2 text-gray-300">·</span>
        <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-600 hover:underline">
          CRM
        </Link>
      </p>

      <PatientProfileHeader tenantId={tenantId} data={data} />

      <PatientContactDetailsCard data={data} />
      <PatientImportedSourceSection data={data} />

      <p className="rounded border border-blue-100 bg-blue-50/80 p-3 text-sm text-blue-950">
        Patient profiles are the foundation for future clinical records, images, treatment plans, HLI assessments,
        HairAudit outcomes, and SurgeryOS workflows.
      </p>

      <PatientProfileSummaryCards data={data} />

      <PatientClinicalDetailsCard tenantId={tenantId} data={data} />

      <PatientImagesCard tenantId={tenantId} data={data} />

      <PatientTreatmentTimelineCard patientTimeline={data.patientTimeline} patientImages={data.patientImages} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PatientPersonDetailsCard data={data} />
        <PatientAdminNotesCard tenantId={tenantId} data={data} />
        <PatientLinkedLeadsCard tenantId={tenantId} data={data} />
        <PatientBookingsCard tenantId={tenantId} data={data} />
        <PatientCasesCard tenantId={tenantId} data={data} />
        <PatientActivityCard tenantId={tenantId} data={data} />
      </div>
    </div>
  );
}
