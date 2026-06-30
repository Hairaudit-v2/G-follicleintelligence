import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CaseSummaryDocumentPage } from "@/src/components/fi-admin/cases/CaseSummaryDocumentPage";
import {
  caseDetailPageHref,
  sanitizeFromCasesSearchParam,
} from "@/src/lib/cases/caseDetailFromCasesParam";
import { buildCaseReadiness } from "@/src/lib/cases/caseReadinessBuild";
import { loadCaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import { loadFollowUpsForCase, loadPostOpTrackingForCase } from "@/src/lib/cases/postOpLoaders";
import { loadProcedureDayForCase } from "@/src/lib/cases/procedureDayLoaders";
import { buildCaseSummaryDocument } from "@/src/lib/cases/caseSummaryDocumentBuild";
import { buildCaseTimeline } from "@/src/lib/cases/caseTimelineBuild";
import { loadCaseTimelineExtraSources } from "@/src/lib/cases/caseTimelineLoaders";
import { loadSurgeryPlanForCase } from "@/src/lib/cases/surgeryPlanningLoaders";

export const metadata = {
  title: "Patient summary",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CaseSummaryDocumentRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; caseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, caseId } = await params;
  const sp = (await searchParams) ?? {};

  if (!tenantId?.trim() || !caseId?.trim()) notFound();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (te || !tenant) notFound();

  const [detail, surgeryPlan, procedureDay, postOpTracking, followUps, timelineExtra] =
    await Promise.all([
      loadCaseAdminDetail(tenantId, caseId),
      loadSurgeryPlanForCase(tenantId, caseId),
      loadProcedureDayForCase(tenantId, caseId),
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

  const document = buildCaseSummaryDocument({
    tenantId,
    detail,
    surgeryPlan,
    procedureDay,
    postOpTracking,
    followUps,
    timelineItems,
    readiness,
  });

  const casesListReturnQuery = sanitizeFromCasesSearchParam(sp.fromCases);
  const caseDetailHref = caseDetailPageHref(tenantId, caseId, casesListReturnQuery);

  return <CaseSummaryDocumentPage document={document} caseDetailHref={caseDetailHref} />;
}
