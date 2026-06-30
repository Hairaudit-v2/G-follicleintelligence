import Link from "next/link";
import type { CaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import { caseSummaryDocumentPageHref } from "@/src/lib/cases/caseDetailFromCasesParam";
import { CASE_DETAIL_SECTION_IDS } from "@/src/lib/cases/caseDetailNavConstants";
import { UniversalCaseRecord } from "@/src/components/fi/UniversalCaseRecord";
import type { UniversalCaseRecordResult } from "@/src/lib/fi/foundation/caseRecord";
import { CaseClinicalIntelligencePanel } from "@/src/components/fi-admin/cases/CaseClinicalIntelligencePanel";
import { CaseOutcomeIntelligencePanel } from "@/src/components/fi-admin/cases/CaseOutcomeIntelligencePanel";
import { CaseAppointmentsCard } from "./CaseAppointmentsCard";
import { CaseCrmQuotesPipelineCard } from "./CaseCrmQuotesPipelineCard";
import { CaseDetailBackLink } from "./CaseDetailBackLink";
import { CaseDetailSection } from "./CaseDetailSection";
import { CaseDetailSectionNav } from "./CaseDetailSectionNav";
import { CaseImagesCard } from "./CaseImagesCard";
import { CaseLinkedLeadCard } from "./CaseLinkedLeadCard";
import { CaseLinkedPatientCard } from "./CaseLinkedPatientCard";
import { CasePlanningNotesPanel } from "./CasePlanningNotesPanel";
import { CasePostOpTrackingCard } from "./CasePostOpTrackingCard";
import { CaseReadinessSummaryCard } from "./CaseReadinessSummaryCard";
import { CaseProcedureDayCard } from "./CaseProcedureDayCard";
import { CaseSurgeryPlanningCard } from "./CaseSurgeryPlanningCard";
import { CaseSummaryCard } from "./CaseSummaryCard";
import { CaseTimelineCard } from "./CaseTimelineCard";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";
import type { ProcedureTeamPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { CaseFollowUpRow, CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import type { CaseReadinessReport } from "@/src/lib/cases/caseReadinessTypes";
import type { CaseTimelineItem } from "@/src/lib/cases/caseTimelineTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { PatientTwinNavLink } from "@/src/components/fi-admin/patientTwin/PatientTwinNavLink";
import { CasePrescriptionsSection } from "@/src/components/fi-admin/prescribing/CasePrescriptionsSection";
import { CaseRevenuePaymentsCard } from "@/src/components/fi-admin/revenue/CaseRevenuePaymentsCard";
import { FinancialPaymentPathwayBadge } from "@/src/components/fi/financial/FinancialPaymentPathwayBadge";
import { FinancialClearancePanel } from "@/src/components/fi/financial/FinancialClearancePanel";
import { FinancialSurgeryPipelineInline } from "@/src/components/fi/financial/FinancialSurgeryPipelineInline";
import { FinancialSurgeryEconomicsCard } from "@/src/components/fi/financial/FinancialSurgeryEconomicsCard";
import { FinancialCaseAccountsReceivableCard } from "@/src/components/fi/financial/FinancialCaseAccountsReceivableCard";
import { FinancialRevenueAttributionRepairCard } from "@/src/components/fi/financial/FinancialRevenueAttributionRepairCard";
import type { CaseAccountsReceivableSummary } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import type { FiRevenueAttributionManualOverrideRow } from "@/src/lib/financialOs/financialRevenueAttributionCore";
import type { CasePaymentReadiness } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import type { FinancialClearanceResult } from "@/src/lib/financialOs/financialClearanceCore";
import type { FinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import type { SurgeryProfitabilitySnapshotReadiness } from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import type { SurgeryEconomicsCaseSummary } from "@/src/lib/financialOs/financialSurgeryEconomics.server";
import type { CaseCrmQuoteRow } from "@/src/lib/crm/crmQuoteLoaders.server";
import { PaymentRecordPanel } from "@/src/components/fi-admin/payments/PaymentRecordPanel";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import type { CaseOutcomeIntelligenceView } from "@/src/lib/fi-os/outcomeIntelligence.server";
import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";

function caseSelfQuery(casesListReturnQuery?: string, opts?: { foundation?: "1" }): string {
  const p = new URLSearchParams();
  if (opts?.foundation) p.set("foundation", opts.foundation);
  if (casesListReturnQuery) p.set("fromCases", casesListReturnQuery);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function CaseDetailPageView({
  tenantId,
  detail,
  surgeryPlan,
  procedureDay,
  teamUserOptions,
  linkedSurgeryBookingYmd,
  postOpTracking,
  followUps,
  timelineItems,
  readiness,
  foundationRecord,
  casesListReturnQuery,
  caseAppointmentBookings,
  operationalTodayYmd,
  initialPaymentRecords = [],
  canMutatePaymentRecords = false,
  outcomeIntelligence,
  casePaymentReadiness,
  caseFinancialPipeline,
  caseFinancialClearance,
  caseSurgeryEconomics,
  caseSurgeryEconomicsReadiness,
  caseSurgeryEconomicsSnapshotCount,
  caseCrmQuotes = [],
  caseRevenueAttributionOverride = null,
  caseRevenueAttributionConsultantOptions = [],
  caseAccountsReceivable,
}: {
  tenantId: string;
  detail: CaseAdminDetail;
  surgeryPlan: CaseSurgeryPlanRow | null;
  procedureDay: CaseProcedureRow | null;
  teamUserOptions: ProcedureTeamPickerOption[];
  /** Earliest non-cancelled surgery booking day on the case (tenant calendar), for procedure-day alignment. */
  linkedSurgeryBookingYmd: string | null;
  postOpTracking: CasePostOpTrackingRow | null;
  followUps: CaseFollowUpRow[];
  timelineItems: CaseTimelineItem[];
  readiness: CaseReadinessReport;
  foundationRecord: UniversalCaseRecordResult | null;
  /** Sanitized cases worklist query string for “back to cases” and deep links. */
  casesListReturnQuery?: string;
  /** Full booking rows for case detail appointments + slide-over shell (merged with patient when linked). */
  caseAppointmentBookings: FiBookingRow[];
  operationalTodayYmd: string;
  initialPaymentRecords?: PaymentRecordRow[];
  canMutatePaymentRecords?: boolean;
  outcomeIntelligence: CaseOutcomeIntelligenceView;
  casePaymentReadiness: CasePaymentReadiness;
  caseFinancialPipeline: FinancialSurgeryPipelineStatus;
  caseFinancialClearance: FinancialClearanceResult;
  caseSurgeryEconomics: SurgeryEconomicsCaseSummary;
  caseSurgeryEconomicsReadiness: SurgeryProfitabilitySnapshotReadiness;
  caseSurgeryEconomicsSnapshotCount: number;
  caseCrmQuotes?: CaseCrmQuoteRow[];
  caseRevenueAttributionOverride?: FiRevenueAttributionManualOverrideRow | null;
  caseRevenueAttributionConsultantOptions?: Array<{ value: string; label: string }>;
  caseAccountsReceivable: CaseAccountsReceivableSummary;
}) {
  const patientId =
    detail.patient?.foundation_patient_id ??
    detail.foundation_patient_id ??
    detail.legacy_patient_id;
  /** Foundation patient UUID for Patient Twin (omit link when only legacy linkage without fi_patients row). */
  const twinFoundationPatientId =
    detail.foundation_patient_id ?? detail.patient?.foundation_patient_id ?? null;
  const prefillPatientId = detail.patient?.foundation_patient_id ?? null;
  const prefillPersonId = detail.patient?.person_id ?? null;
  const prefillLeadId =
    detail.leads.find((l) => l.link_reason === "case_id")?.id ?? detail.leads[0]?.id ?? null;
  const prefillClinicId = detail.clinic_id;
  const casePath = `/fi-admin/${tenantId}/cases/${detail.id}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
        <CaseDetailBackLink tenantId={tenantId} casesListReturnQuery={casesListReturnQuery} />
        {detail.leads.length ? (
          <>
            <span className="text-gray-300">·</span>
            <Link href={`/fi-admin/${tenantId}/crm`} className="text-blue-300 hover:underline">
              CRM
            </Link>
          </>
        ) : null}
        <span className="text-gray-300">·</span>
        <Link
          href={`/fi-admin/${tenantId}/surgery-readiness`}
          className="text-blue-300 hover:underline"
        >
          Surgery readiness
        </Link>
        <span className="text-gray-300">·</span>
        <Link
          href={`/fi-admin/${tenantId}/procedure-day`}
          className="text-blue-300 hover:underline"
        >
          Procedure day board
        </Link>
      </p>

      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 id="case-detail-page-heading" className="text-lg font-semibold text-slate-100">
            Treatment patient
          </h1>
          <div className="flex flex-shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {twinFoundationPatientId ? (
              <PatientTwinNavLink tenantId={tenantId} patientId={twinFoundationPatientId} />
            ) : null}
            <Link
              href={caseSummaryDocumentPageHref(tenantId, detail.id, casesListReturnQuery)}
              className="shrink-0 self-start text-sm font-medium text-blue-300 hover:underline sm:self-center"
            >
              Print / Export summary
            </Link>
            {detail.foundation_patient_id ? (
              <VoiceNoteEntryButton
                tenantId={tenantId}
                patientId={detail.foundation_patient_id}
                caseId={detail.id}
              />
            ) : null}
          </div>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Tenant-scoped patient profile for SurgeryOS: Stage 5A core profile, Stage 5B surgery
          planning, Stage 5C procedure day, Stage 5D post-op / outcome tracking, Stage 5E unified
          timeline, Stage 5F readiness indicators, Stage 5G–5I worklist navigation polish,
          patient-level planning notes, and Stage 5J read-only summary / print. HairAudit scoring,
          formal audit grading, AI outcome scoring, and certification scoring are not part of this
          surface.
        </p>
      </div>

      <CaseDetailSectionNav />

      <div className="space-y-8 lg:space-y-10">
        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.summary}>
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
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.readiness}>
          <CaseReadinessSummaryCard report={readiness} />
          <div className="mt-6">
            <CaseCrmQuotesPipelineCard
              tenantId={tenantId}
              caseId={detail.id}
              patientFoundationId={twinFoundationPatientId}
              leadId={prefillLeadId}
              personId={prefillPersonId}
              clinicId={prefillClinicId}
              quotes={caseCrmQuotes}
            />
          </div>
          <div className="mt-6 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
            <PaymentRecordPanel
              tenantId={tenantId}
              todayYmd={operationalTodayYmd}
              paymentContext="surgery"
              caseId={detail.id}
              patientId={twinFoundationPatientId}
              leadId={prefillLeadId}
              initialRows={initialPaymentRecords}
              canMutate={canMutatePaymentRecords}
              noManualPaymentRecordsCopy="No manual payment records linked to this case yet."
            />
          </div>
          <div className="mt-6 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
            <h3 className="text-sm font-semibold text-slate-100">FinancialOS · Surgery pipeline</h3>
            <p className="mt-1 text-xs text-slate-400">
              Revenue invoices and booking financial overlay — additive to manual payment records
              above.
            </p>
            <div className="mt-3">
              <FinancialSurgeryPipelineInline
                tenantId={tenantId}
                caseId={detail.id}
                status={caseFinancialPipeline}
                variant="light"
                compact={false}
              />
              <div className="mt-3">
                <FinancialClearancePanel
                  tenantId={tenantId}
                  clearance={caseFinancialClearance}
                  currency={caseFinancialPipeline.currency}
                  variant="light"
                />
              </div>
              <div className="mt-2">
                <FinancialPaymentPathwayBadge
                  summary={caseFinancialPipeline.paymentPathway}
                  variant="light"
                />
              </div>
              <div className="mt-3">
                <FinancialSurgeryEconomicsCard
                  tenantId={tenantId}
                  caseId={detail.id}
                  summary={caseSurgeryEconomics}
                  readiness={caseSurgeryEconomicsReadiness}
                  snapshotCount={caseSurgeryEconomicsSnapshotCount}
                  canMutate={canMutatePaymentRecords}
                  variant="light"
                />
              </div>
              <div className="mt-3">
                <FinancialCaseAccountsReceivableCard
                  tenantId={tenantId}
                  caseId={detail.id}
                  summary={caseAccountsReceivable}
                  variant="light"
                />
              </div>
              <div className="mt-3">
                <FinancialRevenueAttributionRepairCard
                  tenantId={tenantId}
                  caseId={detail.id}
                  override={caseRevenueAttributionOverride}
                  consultantOptions={caseRevenueAttributionConsultantOptions}
                  canMutate={canMutatePaymentRecords}
                  variant="light"
                />
              </div>
            </div>
          </div>
          <div className="mt-6">
            <CaseRevenuePaymentsCard
              tenantId={tenantId}
              caseId={detail.id}
              patientFoundationId={twinFoundationPatientId}
              readiness={casePaymentReadiness}
              canMutate={canMutatePaymentRecords}
            />
          </div>
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.caseIntelligence}>
          <CaseClinicalIntelligencePanel
            tenantId={tenantId}
            caseId={detail.id}
            patientFoundationId={twinFoundationPatientId}
            readiness={readiness}
          />
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.outcomeIntelligence}>
          <CaseOutcomeIntelligencePanel view={outcomeIntelligence} />
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.timeline}>
          <CaseTimelineCard items={timelineItems} />
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.surgeryPlanning}>
          <CaseSurgeryPlanningCard
            tenantId={tenantId}
            caseId={detail.id}
            plan={surgeryPlan}
            foundationPatientId={twinFoundationPatientId}
            procedureDay={procedureDay}
            linkedSurgeryBookingYmd={linkedSurgeryBookingYmd}
          />
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.procedureDay}>
          <CaseProcedureDayCard
            tenantId={tenantId}
            caseId={detail.id}
            procedure={procedureDay}
            teamUserOptions={teamUserOptions}
            linkedSurgeryBookingYmd={linkedSurgeryBookingYmd}
          />
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.postOp}>
          <CasePostOpTrackingCard
            tenantId={tenantId}
            caseId={detail.id}
            tracking={postOpTracking}
            followUps={followUps}
            imageOptions={detail.images}
          />
        </CaseDetailSection>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.patient} className="min-w-0">
            <CaseLinkedPatientCard tenantId={tenantId} patient={detail.patient} />
          </CaseDetailSection>
          <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.lead} className="min-w-0">
            <CaseLinkedLeadCard tenantId={tenantId} leads={detail.leads} />
          </CaseDetailSection>
          <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.bookings} className="min-w-0">
            <CaseAppointmentsCard
              tenantId={tenantId}
              caseId={detail.id}
              bookings={caseAppointmentBookings}
              prefillPersonId={prefillPersonId}
              prefillPatientId={prefillPatientId}
              prefillLeadId={prefillLeadId}
              prefillClinicId={prefillClinicId}
            />
          </CaseDetailSection>
          <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.images} className="min-w-0">
            <CaseImagesCard tenantId={tenantId} patientId={patientId} images={detail.images} />
          </CaseDetailSection>
        </div>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.prescriptions}>
          <CasePrescriptionsSection
            tenantId={tenantId}
            caseId={detail.id}
            foundationPatientId={
              detail.foundation_patient_id ?? detail.patient?.foundation_patient_id ?? null
            }
          />
        </CaseDetailSection>

        <CaseDetailSection id={CASE_DETAIL_SECTION_IDS.notes}>
          <CasePlanningNotesPanel
            tenantId={tenantId}
            caseId={detail.id}
            initialPlanningNotes={detail.planning_notes}
            updatedAt={detail.updated_at}
          />
        </CaseDetailSection>
      </div>

      {!foundationRecord ? (
        <p className="text-xs text-gray-500">
          <Link
            className="text-blue-300 hover:underline"
            href={`${casePath}${caseSelfQuery(casesListReturnQuery, { foundation: "1" })}`}
          >
            Load universal patient record
          </Link>{" "}
          (read-only timeline, media, identifiers).
        </p>
      ) : null}

      {foundationRecord ? (
        <div className="space-y-2">
          <p className="text-right text-xs">
            <Link
              className="text-blue-300 hover:underline"
              href={`${casePath}${caseSelfQuery(casesListReturnQuery)}`}
            >
              Hide foundation view
            </Link>
          </p>
          <details className="rounded border border-white/[0.08] bg-white/[0.03] p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-200">
              Advanced: universal patient record (read-only)
            </summary>
            <p className="mt-2 text-xs text-slate-400">
              Full foundation aggregate (timeline, unified media, identifiers) for operators who
              need ingest-level context.
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
