import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CaseDetailPageView } from "@/src/components/fi-admin/cases/CaseDetailPageView";
import { loadCaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import { loadSurgeryPlanForCase } from "@/src/lib/cases/surgeryPlanningLoaders";
import { loadUniversalCaseRecord } from "@/src/lib/fi/foundation/caseRecord";

export const metadata = {
  title: "Case",
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

  const [detail, surgeryPlan] = await Promise.all([
    loadCaseAdminDetail(tenantId, caseId),
    loadSurgeryPlanForCase(tenantId, caseId),
  ]);
  if (!detail) notFound();

  const foundationParam = sp.foundation;
  const showFoundation =
    foundationParam === "1" ||
    foundationParam === "true" ||
    (Array.isArray(foundationParam) && foundationParam.some((v) => v === "1" || v === "true"));

  const foundationRecord = showFoundation ? await loadUniversalCaseRecord({ tenantId, caseId }) : null;
  const foundationOk = foundationRecord && foundationRecord.ok ? foundationRecord : null;

  return (
    <CaseDetailPageView tenantId={tenantId} detail={detail} surgeryPlan={surgeryPlan} foundationRecord={foundationOk} />
  );
}
