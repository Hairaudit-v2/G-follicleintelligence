/**
 * FI-UX-REBUILD D6 — Phase 2 realtime subscription plan.
 * Tenant-scoped Supabase Realtime on low-risk operational tables; polling remains fallback.
 */

export type TodayRealtimeSubscriptionSpec = {
  table: string;
  schema: "public";
  events: readonly ("INSERT" | "UPDATE" | "DELETE")[];
  tenantFilterColumn: "tenant_id";
  refreshStrategy: "debounced_router_refresh";
  fallbackPollingMs: number;
  privacyNotes: string;
};

export const TODAY_REALTIME_DEFAULT_POLL_MS = 30_000;
export const TODAY_REALTIME_VISIBLE_POLL_MS = 15_000;
export const TODAY_REALTIME_REVISION_POLL_MS = 10_000;
export const TODAY_REALTIME_DEBOUNCE_MS = 1_500;

/** REALTIME SUBSCRIPTION PLAN — v1 low-risk tables only. */
export const TODAY_REALTIME_SUBSCRIPTION_PLAN: readonly TodayRealtimeSubscriptionSpec[] = [
  {
    table: "fi_bookings",
    schema: "public",
    events: ["INSERT", "UPDATE"],
    tenantFilterColumn: "tenant_id",
    refreshStrategy: "debounced_router_refresh",
    fallbackPollingMs: TODAY_REALTIME_DEFAULT_POLL_MS,
    privacyNotes: "Subscribe by tenant_id only; never log row payloads client-side.",
  },
  {
    table: "fi_payment_records",
    schema: "public",
    events: ["INSERT", "UPDATE"],
    tenantFilterColumn: "tenant_id",
    refreshStrategy: "debounced_router_refresh",
    fallbackPollingMs: TODAY_REALTIME_DEFAULT_POLL_MS,
    privacyNotes: "Amounts and patient IDs stay server-side; refresh recomputes feed.",
  },
  {
    table: "fi_pathology_results",
    schema: "public",
    events: ["INSERT", "UPDATE"],
    tenantFilterColumn: "tenant_id",
    refreshStrategy: "debounced_router_refresh",
    fallbackPollingMs: TODAY_REALTIME_DEFAULT_POLL_MS,
    privacyNotes: "Result IDs only in revision fingerprint; no PHI in client logs.",
  },
  {
    table: "fi_crm_leads",
    schema: "public",
    events: ["UPDATE"],
    tenantFilterColumn: "tenant_id",
    refreshStrategy: "debounced_router_refresh",
    fallbackPollingMs: TODAY_REALTIME_DEFAULT_POLL_MS,
    privacyNotes: "Lead titles remain server-rendered only.",
  },
  {
    table: "fi_staff_compliance_alerts",
    schema: "public",
    events: ["INSERT", "UPDATE"],
    tenantFilterColumn: "tenant_id",
    refreshStrategy: "debounced_router_refresh",
    fallbackPollingMs: TODAY_REALTIME_DEFAULT_POLL_MS,
    privacyNotes: "Staff names rendered server-side after refresh.",
  },
];

function parseTenantAllowlist(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Opt-in gate — mirrors Today / workspace shell rollout pattern. */
export function isTodayRealtimeEnabledForTenant(tenantId: string): boolean {
  const tid = tenantId.trim().toLowerCase();
  if (!tid) return false;
  if (process.env.FI_TODAY_REALTIME_ENABLED?.trim().toLowerCase() === "true") return true;
  return parseTenantAllowlist(process.env.FI_TODAY_REALTIME_TENANT_IDS).has(tid);
}

/** Lightweight revision polling when Realtime is unavailable (no Supabase session). */
export function isTodaySignalRevisionPollEnabled(): boolean {
  const v = process.env.FI_TODAY_SIGNAL_REVISION_POLL?.trim().toLowerCase();
  return v === "true" || v === "1";
}
