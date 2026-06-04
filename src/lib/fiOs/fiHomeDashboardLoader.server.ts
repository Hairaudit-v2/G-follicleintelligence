import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantConfigurationOverview } from "@/src/lib/fi/foundation/tenantSettings";

export type FiHomeNextAction = {
  title: string;
  description: string;
  href: string;
};

export type FiHomeDashboardPayload = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  counts: {
    organisations: number;
    clinics: number;
    persons: number;
    patients: number;
    cases: number;
  };
  /** 0–1 based on visible checklist items only */
  setupProgressRatio: number;
  nextAction: FiHomeNextAction;
  checklist: {
    organisationCreated: boolean;
    clinicCreated: boolean;
    clinicSettingsComplete: boolean;
    firstCaseCreated: boolean;
    /** Only when CRM shell nav is allowed for this user */
    crmAccessAvailable: boolean | null;
    bookingsCalendarAvailable: boolean | null;
  };
};

function clinicSettingsComplete(overview: Awaited<ReturnType<typeof loadTenantConfigurationOverview>>): boolean {
  if (overview.clinics.length === 0) return false;
  return overview.clinics.every((c) => c.settings != null);
}

function computeNextAction(
  tenantId: string,
  overview: Awaited<ReturnType<typeof loadTenantConfigurationOverview>>,
  caseCount: number
): FiHomeNextAction {
  const base = `/fi-admin/${tenantId}`;
  if (overview.organisations.length === 0) {
    return {
      title: "Create an organisation",
      description: "Every clinic belongs to an organisation. Start by creating your first organisation in the directory.",
      href: `${base}/directory`,
    };
  }
  if (overview.clinics.length === 0) {
    return {
      title: "Create a clinic",
      description: "Add at least one clinic under your organisation so cases and settings can be scoped correctly.",
      href: `${base}/directory`,
    };
  }
  if (!clinicSettingsComplete(overview)) {
    return {
      title: "Complete clinic configuration",
      description: "Finish clinic-level details (contact, timezone, URLs) so branding and workflows resolve correctly.",
      href: `${base}/configuration`,
    };
  }
  if (caseCount === 0) {
    return {
      title: "Create your first case",
      description: "Use the guided wizard to add a person, patient record, and case in one flow.",
      href: `${base}/cases/new`,
    };
  }
  return {
    title: "Open cases",
    description: "Your foundation is in place. Continue day-to-day work in the cases worklist.",
    href: `${base}/cases`,
  };
}

function computeSetupProgress(
  overview: Awaited<ReturnType<typeof loadTenantConfigurationOverview>>,
  caseCount: number,
  showCrmShellItems: boolean
): number {
  const org = overview.organisations.length > 0;
  const clinic = overview.clinics.length > 0;
  const settings = clinicSettingsComplete(overview);
  const firstCase = caseCount > 0;
  const crm = showCrmShellItems;
  const bookings = showCrmShellItems;

  const items = [org, clinic, settings, firstCase];
  if (showCrmShellItems) {
    items.push(crm, bookings);
  }
  const done = items.filter(Boolean).length;
  return done / items.length;
}

/**
 * Read-only snapshot for the FI Admin tenant home dashboard.
 * Composes {@link loadTenantConfigurationOverview} with lightweight entity counts.
 */
export async function loadFiHomeDashboardPayload(
  tenantId: string,
  options: { showCrmShellChecklistItems: boolean }
): Promise<FiHomeDashboardPayload> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const [tenantRes, overview, personsRes, patientsRes, casesRes] = await Promise.all([
    supabase.from("fi_tenants").select("id, name, slug").eq("id", tid).maybeSingle(),
    loadTenantConfigurationOverview(tid),
    supabase.from("fi_persons").select("*", { count: "exact", head: true }).eq("tenant_id", tid),
    supabase.from("fi_patients").select("*", { count: "exact", head: true }).eq("tenant_id", tid),
    supabase.from("fi_cases").select("*", { count: "exact", head: true }).eq("tenant_id", tid),
  ]);

  if (tenantRes.error) throw new Error(tenantRes.error.message);
  const tenant = tenantRes.data as { id: string; name: string; slug: string | null } | null;
  if (!tenant) throw new Error("Tenant not found");

  if (personsRes.error) throw new Error(personsRes.error.message);
  if (patientsRes.error) throw new Error(patientsRes.error.message);
  if (casesRes.error) throw new Error(casesRes.error.message);

  const caseCount = casesRes.count ?? 0;

  const checklist = {
    organisationCreated: overview.organisations.length > 0,
    clinicCreated: overview.clinics.length > 0,
    clinicSettingsComplete: clinicSettingsComplete(overview),
    firstCaseCreated: caseCount > 0,
    crmAccessAvailable: options.showCrmShellChecklistItems ? true : null,
    bookingsCalendarAvailable: options.showCrmShellChecklistItems ? true : null,
  };

  return {
    tenantId: tid,
    tenantName: String(tenant.name ?? "").trim() || tid,
    tenantSlug: tenant.slug == null ? null : String(tenant.slug),
    counts: {
      organisations: overview.organisations.length,
      clinics: overview.clinics.length,
      persons: personsRes.count ?? 0,
      patients: patientsRes.count ?? 0,
      cases: caseCount,
    },
    setupProgressRatio: computeSetupProgress(overview, caseCount, options.showCrmShellChecklistItems),
    nextAction: computeNextAction(tid, overview, caseCount),
    checklist,
  };
}
