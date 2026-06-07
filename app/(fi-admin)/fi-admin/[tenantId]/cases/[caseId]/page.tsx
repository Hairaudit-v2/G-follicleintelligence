import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AppointmentSlideOverProvider } from "@/src/components/fi/appointments/AppointmentSlideOver";
import { CaseDetailPageView } from "@/src/components/fi-admin/cases/CaseDetailPageView";
import { loadCaseAppointmentBookingsForShell } from "@/src/lib/cases/caseAppointmentShellLoader.server";
import { loadCaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { getBookingsOperatorSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadCrmShellScopePickerOptions, loadCrmShellStaffPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";
import { loadFollowUpsForCase, loadPostOpTrackingForCase } from "@/src/lib/cases/postOpLoaders";
import { loadFiUsersForProcedureTeamPicker, loadProcedureDayForCase } from "@/src/lib/cases/procedureDayLoaders";
import { loadSurgeryPlanForCase } from "@/src/lib/cases/surgeryPlanningLoaders";
import { buildCaseReadiness } from "@/src/lib/cases/caseReadinessBuild";
import { buildCaseTimeline } from "@/src/lib/cases/caseTimelineBuild";
import { loadCaseTimelineExtraSources } from "@/src/lib/cases/caseTimelineLoaders";
import { loadUniversalCaseRecord } from "@/src/lib/fi/foundation/caseRecord";
import { sanitizeFromCasesSearchParam } from "@/src/lib/cases/caseDetailFromCasesParam";

export const metadata = {
  title: "Patient",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CaseDetailRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; caseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, caseId } = await params;
  const sp = (await searchParams) ?? {};

  if (!tenantId?.trim() || !caseId?.trim()) notFound();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const [detail, surgeryPlan, procedureDay, teamUserOptions, postOpTracking, followUps, timelineExtra] =
    await Promise.all([
      loadCaseAdminDetail(tenantId, caseId),
      loadSurgeryPlanForCase(tenantId, caseId),
      loadProcedureDayForCase(tenantId, caseId),
      loadFiUsersForProcedureTeamPicker(tenantId),
      loadPostOpTrackingForCase(tenantId, caseId),
      loadFollowUpsForCase(tenantId, caseId),
      loadCaseTimelineExtraSources(tenantId, caseId),
    ]);
  if (!detail) notFound();

  const timelineItems = buildCaseTimeline({
    tenantId,
    caseId,
    detail,
    surgeryPlan,
    procedureDay,
    postOpTracking,
    followUps,
    extra: timelineExtra,
  });

  const readiness = buildCaseReadiness({
    detail,
    surgeryPlan,
    procedureDay,
    postOpTracking,
    followUps,
    timelineItems,
  });

  const casesListReturnQuery = sanitizeFromCasesSearchParam(sp.fromCases);

  const foundationParam = sp.foundation;
  const showFoundation =
    foundationParam === "1" ||
    foundationParam === "true" ||
    (Array.isArray(foundationParam) && foundationParam.some((v) => v === "1" || v === "true"));

  const foundationRecord = showFoundation ? await loadUniversalCaseRecord({ tenantId, caseId }) : null;
  const foundationOk = foundationRecord && foundationRecord.ok ? foundationRecord : null;

  const linkedFiPatientId = detail.patient?.foundation_patient_id ?? null;
  const [caseAppointmentBookings, services, calendarSettings, assignees, scope, bookingSession] = await Promise.all([
    loadCaseAppointmentBookingsForShell(tenantId, caseId, linkedFiPatientId),
    loadFiServicesForTenant(tenantId.trim()),
    loadTenantOperationalCalendarSettings(tenantId.trim()),
    loadCrmShellStaffPickerOptions(tenantId.trim()),
    loadCrmShellScopePickerOptions(tenantId.trim()),
    getBookingsOperatorSessionIfAllowed(tenantId.trim()),
  ]);

  const pageView = (
    <CaseDetailPageView
      tenantId={tenantId}
      detail={detail}
      surgeryPlan={surgeryPlan}
      procedureDay={procedureDay}
      teamUserOptions={teamUserOptions}
      postOpTracking={postOpTracking}
      followUps={followUps}
      timelineItems={timelineItems}
      readiness={readiness}
      foundationRecord={foundationOk}
      casesListReturnQuery={casesListReturnQuery}
      caseAppointmentBookings={caseAppointmentBookings}
    />
  );

  if (!bookingSession) return pageView;

  return (
    <AppointmentSlideOverProvider
      tenantId={tenantId}
      operatorFiUserId={bookingSession.fiUserId}
      userRole={bookingSession.role}
      assignees={assignees}
      clinics={scope.clinics}
      existingBookings={caseAppointmentBookings}
      calendarTimezone={calendarSettings.calendarTimezone}
      services={services}
    >
      {pageView}
    </AppointmentSlideOverProvider>
  );
}
