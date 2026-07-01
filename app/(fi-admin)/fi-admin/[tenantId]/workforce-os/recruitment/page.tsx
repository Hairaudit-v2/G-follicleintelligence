import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { WorkforceOsRecruitmentClient } from "@/src/components/fi/workforce/WorkforceOsRecruitmentClient";
import { loadWorkforceOsRecruitmentPage } from "@/src/lib/workforce/recruitmentPipelinePage.server";

export const metadata = {
  title: "Recruitment pipeline · WorkforceOS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsRecruitmentPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const data = await loadWorkforceOsRecruitmentPage(tenantId.trim());
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <WorkforceOsRecruitmentClient
        tenantId={tenantId.trim()}
        candidates={data.candidates}
        roleRequirements={data.roleRequirements}
        onboardingTemplates={data.onboardingTemplates}
        stageCounts={data.stageCounts}
        canManage={data.canManage}
      />
    </div>
  );
}