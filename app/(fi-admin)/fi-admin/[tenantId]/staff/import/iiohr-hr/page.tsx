import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { IiohrHrStaffImportClient } from "@/src/components/fi/staff/IiohrHrStaffImportClient";
import { loadStaffDirectoryPage } from "@/src/lib/staff/staffDirectoryLoader.server";

export const metadata = {
  title: "Import IIOHR HR staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function IiohrHrStaffImportPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  const data = await loadStaffDirectoryPage(tid);
  if (!data.canManageStaff) notFound();

  return <IiohrHrStaffImportClient tenantId={tid} />;
}
