import Link from "next/link";
import type { CaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import { UniversalCaseRecord } from "@/src/components/fi/UniversalCaseRecord";
import type { UniversalCaseRecordResult } from "@/src/lib/fi/foundation/caseRecord";
import { CaseBookingsCard } from "./CaseBookingsCard";
import { CaseImagesCard } from "./CaseImagesCard";
import { CaseLinkedLeadCard } from "./CaseLinkedLeadCard";
import { CaseLinkedPatientCard } from "./CaseLinkedPatientCard";
import { CasePlanningNotesPanel } from "./CasePlanningNotesPanel";
import { CaseSummaryCard } from "./CaseSummaryCard";

export function CaseDetailPageView({
  tenantId,
  detail,
  foundationRecord,
}: {
  tenantId: string;
  detail: CaseAdminDetail;
  foundationRecord: UniversalCaseRecordResult | null;
}) {
  const patientId = detail.patient?.foundation_patient_id ?? detail.foundation_patient_id ?? detail.legacy_patient_id;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="text-sm text-gray-600">
        <Link href={`/fi-admin/${tenantId}/cases`} className="text-blue-600 hover:underline">
          ← Cases
        </Link>
        {detail.leads.length ? (
          <>
            <span className="mx-2 text-gray-300">·</span>
            <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-600 hover:underline">
              CRM
            </Link>
          </>
        ) : null}
      </p>

      <div>
        <h1 className="text-lg font-semibold text-gray-900">Treatment case</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Tenant-scoped case profile bridging CRM and SurgeryOS foundations. Edit status, treatment labels, case type, and
          planning notes here; graft planning and procedure-day tooling follow in Stage 5B.
        </p>
      </div>

      <CaseSummaryCard
        tenantId={tenantId}
        initial={{
          id: detail.id,
          status: detail.status,
          treatment_type: detail.treatment_type,
          case_type: detail.case_type,
          external_id: detail.external_id,
          created_at: detail.created_at,
          updated_at: detail.updated_at,
          clinic_id: detail.clinic_id,
          organisation_id: detail.organisation_id,
          partner_id: detail.partner_id,
        }}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CaseLinkedPatientCard tenantId={tenantId} patient={detail.patient} />
        <CaseLinkedLeadCard tenantId={tenantId} leads={detail.leads} />
        <CaseBookingsCard tenantId={tenantId} bookings={detail.bookings} />
        <CaseImagesCard tenantId={tenantId} patientId={patientId} images={detail.images} />
      </div>

      <CasePlanningNotesPanel
        tenantId={tenantId}
        caseId={detail.id}
        initialPlanningNotes={detail.planning_notes}
        updatedAt={detail.updated_at}
      />

      {!foundationRecord ? (
        <p className="text-xs text-gray-500">
          <Link className="text-blue-600 hover:underline" href={`?foundation=1`}>
            Load universal case record
          </Link>{" "}
          (read-only timeline, media, identifiers).
        </p>
      ) : null}

      {foundationRecord ? (
        <div className="space-y-2">
          <p className="text-right text-xs">
            <Link className="text-blue-600 hover:underline" href={`/fi-admin/${tenantId}/cases/${detail.id}`}>
              Hide foundation view
            </Link>
          </p>
          <details className="rounded border border-gray-200 bg-gray-50/50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-gray-800">Advanced: universal case record (read-only)</summary>
            <p className="mt-2 text-xs text-gray-600">
              Full foundation aggregate (timeline, unified media, identifiers) for operators who need ingest-level
              context.
            </p>
            <div className="mt-4">
              <UniversalCaseRecord tenantId={tenantId} record={foundationRecord} />
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
