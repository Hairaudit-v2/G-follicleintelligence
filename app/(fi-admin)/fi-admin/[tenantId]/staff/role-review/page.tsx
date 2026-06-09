import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { StaffRoleReviewClient } from "@/src/components/fi/staff/StaffRoleReviewClient";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { loadStaffRoleReviewPage } from "@/src/lib/staff/staffRoleReviewLoader.server";

export const metadata = {
  title: "Assign staff roles",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffRoleReviewPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  try {
    const model = await loadStaffRoleReviewPage(tid);
    return <StaffRoleReviewClient tenantId={tid} initialRows={model.rows} clinics={model.clinics} />;
  } catch (e) {
    if (e instanceof CrmAccessError && (e.status === 401 || e.status === 403)) {
      notFound();
    }
    throw e;
  }
}
