import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FinancialOsAccountsReceivableWorkQueue } from "@/src/components/fi-admin/financial-os/FinancialOsAccountsReceivableWorkQueue";
import {
  FinancialOsSubPageHeader,
  financialOsClasses,
} from "@/src/components/fi-admin/financial-os/financialOsUi";
import { loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadAccountsReceivableWorkQueue } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import { getPaymentRecordMutationCapability } from "@/src/lib/payments/paymentRecordAccess.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const metadata: Metadata = {
  title: "FinancialOS · Accounts receivable",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseFilters(sp: Record<string, string | string[] | undefined>) {
  const one = (key: string) => {
    const v = sp[key];
    if (typeof v === "string") return v.trim() || null;
    return null;
  };
  return {
    risk: one("risk"),
    status: one("status"),
    receivable_type: one("type"),
    assigned_fi_user_id: one("owner"),
    clinic_id: one("clinic"),
  };
}

export default async function FinancialOsAccountsReceivablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = (await searchParams) ?? {};
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);

  const filters = parseFilters(sp);

  const [rows, users, { canMutate }] = await Promise.all([
    loadAccountsReceivableWorkQueue(tid, filters),
    loadCrmShellUserPickerOptions(tid),
    getPaymentRecordMutationCapability(tid),
  ]);

  const supabase = supabaseAdmin();
  const { data: clinicsRaw } = await supabase
    .from("fi_clinics")
    .select("id, name")
    .eq("tenant_id", tid)
    .order("name");
  const clinicOptions = (clinicsRaw ?? []).map((c) => {
    const raw = c as { id: string; name?: string | null };
    return { value: raw.id, label: raw.name?.trim() || raw.id.slice(0, 8) };
  });

  return (
    <div className={financialOsClasses.pageSection}>
      <FinancialOsSubPageHeader
        kicker="Collections"
        title="Accounts receivable work queue"
        description={
          <>
            Prioritise and recover outstanding revenue. Reminders are draft-only in Phase 4 — no
            live SMS or email is sent (
            <code className={financialOsClasses.code}>fi_accounts_receivable_events</code>{" "}
            append-only ledger).
          </>
        }
      />
      <FinancialOsAccountsReceivableWorkQueue
        tenantId={tid}
        rows={rows}
        users={users}
        clinicOptions={clinicOptions}
        canMutate={canMutate}
      />
    </div>
  );
}
