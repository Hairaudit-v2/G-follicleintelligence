import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { StaffPinLoginClient } from "@/src/components/fi/staff/StaffPinLoginClient";
import { loadStaffPinLoginPage } from "@/src/lib/staffPin/staffPinLoginLoader.server";

export const metadata = {
  title: "Staff PIN sign-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffPinLoginPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const data = await loadStaffPinLoginPage(tenantId);
  if (!data) notFound();

  return <StaffPinLoginClient data={data} />;
}
