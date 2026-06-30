import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

export const metadata = {
  title: "Import IIOHR HR staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** @deprecated Use `/fi-admin/[tenantId]/hr/staff-import` (CRM-gated HR import). */
export default async function IiohrHrStaffImportLegacyRedirectPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();
  redirect(`/fi-admin/${tid}/hr/staff-import`);
}
