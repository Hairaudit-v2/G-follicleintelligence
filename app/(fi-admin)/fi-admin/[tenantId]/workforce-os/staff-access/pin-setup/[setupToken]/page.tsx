import { notFound } from "next/navigation";

import { StaffAccessPinSetupClient } from "@/src/components/fi/workforce/StaffAccessPinSetupClient";
import { hashStaffAccessInviteToken } from "@/src/lib/team/access/staffAccessInviteCore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

export default async function StaffAccessPinSetupPage({
  params,
}: {
  params: Promise<{ tenantId: string; setupToken: string }>;
}) {
  const { tenantId, setupToken } = await params;
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const tokenHash = hashStaffAccessInviteToken(setupToken);

  const { data, error } = await supabaseAdmin()
    .from("fi_staff_access_pin_setups")
    .select("staff_member_id, fi_staff_id, status, expires_at")
    .eq("tenant_id", tid)
    .eq("setup_token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const row = data as {
    staff_member_id: string;
    fi_staff_id: string;
    status: string;
    expires_at: string;
  };

  if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-rose-200">
        This PIN setup link has expired. Ask your clinic administrator for a new reset link.
      </div>
    );
  }

  const { data: member } = await supabaseAdmin()
    .from("fi_staff_members")
    .select("full_name")
    .eq("tenant_id", tid)
    .eq("id", String(row.staff_member_id))
    .maybeSingle();

  return (
    <StaffAccessPinSetupClient
      tenantId={tid}
      setupToken={setupToken}
      staffName={String((member as { full_name: string } | null)?.full_name ?? "Staff")}
    />
  );
}
