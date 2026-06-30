import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrescriptionsWorkspacePage } from "@/src/components/fi-admin/prescribing/PrescriptionsWorkspacePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return {
    title: `Prescriptions · ${tenantId.slice(0, 8)}…`,
    robots: { index: false, follow: false },
  };
}

export default async function TenantPrescriptionsWorkspacePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return <p className="text-sm text-rose-300">Server misconfigured (Supabase).</p>;
  }

  return (
    <div className="p-4 sm:p-6">
      <PrescriptionsWorkspacePage tenantId={tenantId.trim()} />
    </div>
  );
}
