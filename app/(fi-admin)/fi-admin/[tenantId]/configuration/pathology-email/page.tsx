import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { PathologyEmailRoutesClient } from "@/src/components/fi-admin/pathology/PathologyEmailRoutesClient";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { readPathologyEmailIngestionEnabled } from "@/src/lib/pathology/email/pathologyEmailIngestionEnv.server";
import {
  buildPathologyInboundWebhookUrl,
  resolvePathologyEmailAppOrigin,
} from "@/src/lib/pathology/email/pathologyEmailRoutesCore";
import { loadPathologyEmailRoutesForTenant } from "@/src/lib/pathology/email/pathologyEmailRoutesLoad.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { canViewTenantConfigurationHub } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const metadata: Metadata = {
  title: "Configuration · Pathology email routes",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PathologyEmailRoutesConfigurationPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);
  if (!(await canViewTenantConfigurationHub(tid))) {
    notFound();
  }
  await assertStaffModuleAccess(tid, "settings", "read");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: tenantError } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tid)
    .maybeSingle();
  if (tenantError || !tenant) notFound();

  const [routes, { canMutate }] = await Promise.all([
    loadPathologyEmailRoutesForTenant(tid),
    getPaymentRecordMutationCapability(tid),
  ]);
  const emailIngestionEnabled = readPathologyEmailIngestionEnabled();
  const webhookUrl = buildPathologyInboundWebhookUrl(resolvePathologyEmailAppOrigin());

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link href={`/fi-admin/${tid}/configuration`} className="text-[#22C1FF] hover:underline">
            Configuration
          </Link>{" "}
          / <span className="text-[#CBD5E1]">Pathology email routes</span>
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Pathology email routes
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Manage dedicated inbound pathology addresses for this tenant. Webhooks create inbox
          documents with <code className="text-[#CBD5E1]">source=email</code> — no automatic review.
        </p>
      </div>

      <PathologyEmailRoutesClient
        tenantId={tid}
        initialRoutes={routes}
        webhookUrl={webhookUrl}
        canMutate={canMutate}
        emailIngestionEnabled={emailIngestionEnabled}
      />
    </div>
  );
}
