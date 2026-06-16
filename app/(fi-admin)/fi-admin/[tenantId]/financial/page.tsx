import { redirect } from "next/navigation";

export default async function FinancialOsIndexPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tid = tenantId?.trim() || "";
  redirect(`/fi-admin/${encodeURIComponent(tid)}/financial/dashboard`);
}
