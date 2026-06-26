import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { FieldAccessSection } from "@/src/components/fi-admin/settings/FieldAccessSection";
import { StaffAccessSection } from "@/src/components/fi-admin/settings/StaffAccessSection";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  getStaffAccessAdminPermission,
  getStaffEffectiveAccessForStaffMember,
  listStaffAccessModuleDefinitions,
  loadClinicsForStaffAccess,
  loadStaffAccessGrantRows,
  loadTenantStaffForAccessAdmin,
} from "@/src/lib/staffAccess/staffAccess.server";
import { loadStaffAccessAuditHistory } from "@/src/lib/staffAccess/staffAccessAudit.server";
import {
  loadFieldAccessAdminState,
  loadStaffFieldAccessAuditHistory,
} from "@/src/lib/staffAccess/staffFieldAccess.server";
import { computeEffectiveAccess } from "@/src/lib/staffAccess/staffAccessCore";
import {
  normalizeStaffRoleKey,
  STAFF_ACCESS_MODULE_KEYS,
} from "@/src/lib/staffAccess/staffAccessRegistry";

export const metadata = {
  title: "Staff Access",
  robots: { index: false, follow: false } as const,
};

export const dynamic = "force-dynamic";

export default async function StaffAccessSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const perm = await getStaffAccessAdminPermission(tenantId);
  if (!perm.canView) notFound();

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (te || !tenant) notFound();

  const [staff, clinics] = await Promise.all([
    loadTenantStaffForAccessAdmin(tenantId),
    loadClinicsForStaffAccess(tenantId),
  ]);

  const sp = (await searchParams) ?? {};
  const rawStaffId = sp.staffId;
  const requested = typeof rawStaffId === "string" && rawStaffId.trim() ? rawStaffId.trim() : null;
  const selected =
    requested && staff.some((s) => s.id === requested)
      ? staff.find((s) => s.id === requested)!
      : null;

  const modules = listStaffAccessModuleDefinitions();

  let effectiveRecord: Record<string, { level: string; scope: string; source: string }> | null =
    null;
  let roleRecord: Record<string, { level: string; scope: string }> | null = null;
  let grants: Awaited<ReturnType<typeof loadStaffAccessGrantRows>> = [];
  let audit: Awaited<ReturnType<typeof loadStaffAccessAuditHistory>> = [];
  let fieldState: Awaited<ReturnType<typeof loadFieldAccessAdminState>> | null = null;
  let fieldAudit: Awaited<ReturnType<typeof loadStaffFieldAccessAuditHistory>> = [];

  if (selected) {
    const roleKey = normalizeStaffRoleKey(selected.staffRole);
    const [effective, grantRows, auditRows, fieldAdminState, fieldAuditRows] = await Promise.all([
      getStaffEffectiveAccessForStaffMember(tenantId, selected.id, selected.staffRole),
      loadStaffAccessGrantRows(tenantId, selected.id),
      loadStaffAccessAuditHistory(tenantId, selected.id, 50),
      loadFieldAccessAdminState(tenantId, selected.id, selected.staffRole),
      loadStaffFieldAccessAuditHistory(tenantId, selected.id, 50),
    ]);
    fieldState = fieldAdminState;
    fieldAudit = fieldAuditRows;
    const roleOnly = computeEffectiveAccess({ roleKey, grants: [] });

    effectiveRecord = {};
    roleRecord = {};
    for (const m of STAFF_ACCESS_MODULE_KEYS) {
      effectiveRecord[m] = {
        level: effective[m].level,
        scope: effective[m].scope,
        source: effective[m].source,
      };
      roleRecord[m] = { level: roleOnly[m].level, scope: roleOnly[m].scope };
    }
    grants = grantRows;
    audit = auditRows;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link
            href={`/fi-admin/${tenantId}/configuration`}
            className="text-[#22C1FF] hover:underline"
          >
            Configuration
          </Link>{" "}
          / Staff Access
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">
          Staff Access &amp; Entitlements
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Every staff member keeps a standard <span className="text-[#CBD5E1]">role template</span>,
          then receives optional module/tab grants on top — so a doctor who becomes an investor can
          see AnalyticsOS, FinancialOS, and the Investor Dashboard without changing their clinical
          role. Grants are tenant- or clinic-scoped with read / edit / approve levels and are fully
          audited.
        </p>
      </div>

      <StaffAccessSection
        tenantId={tenantId}
        canManage={perm.canManage}
        staff={staff.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          staffRole: s.staffRole,
          roleKey: s.roleKey,
          isActive: s.isActive,
        }))}
        selectedStaffId={selected?.id ?? null}
        clinics={clinics}
        modules={modules.map((m) => ({
          key: m.key,
          label: m.label,
          description: m.description,
          category: m.category,
        }))}
        effective={effectiveRecord}
        roleDefaults={roleRecord}
        grants={grants}
        audit={audit}
      />

      {selected && fieldState ? (
        <FieldAccessSection
          tenantId={tenantId}
          canManage={perm.canManage}
          staffMemberId={selected.id}
          staffName={selected.fullName || "this staff member"}
          modules={modules.map((m) => ({ key: m.key, label: m.label }))}
          clinics={clinics}
          fieldsByModule={fieldState.fieldsByModule}
          moduleLevels={fieldState.moduleLevels as Record<string, string>}
          audit={fieldAudit.map((a) => ({
            id: a.id,
            moduleKey: a.moduleKey,
            fieldKey: a.fieldKey,
            previousPermission: a.previousPermission,
            newPermission: a.newPermission,
            reason: a.reason,
            createdAt: a.createdAt,
          }))}
        />
      ) : null}
    </div>
  );
}
