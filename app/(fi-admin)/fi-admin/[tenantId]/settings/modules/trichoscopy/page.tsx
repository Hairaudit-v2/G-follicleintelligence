import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import {
  HLI_TRICHOSCOPY_SETTINGS_REQUIRED_ROLES,
} from "@/src/lib/platform/entitlements/modules";
import { isHliTrichoscopyPlatformEnabled } from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";
import { setTrichoscopyModuleConfiguration } from "@/src/lib/platform/entitlements/trichoscopyEntitlementLifecycle.server";
import {
  capabilitiesForTier,
  HLI_TRICHOSCOPY_MODULE_KEY,
  isTrichoscopyCapabilityTier,
  type TrichoscopyCapabilityTier,
  type TrichoscopyModuleSettings,
} from "@/src/lib/platform/entitlements/trichoscopyCapabilities";
import { TrichoscopyModuleSettingsForm } from "@/src/components/trichoscopy/TrichoscopyModuleSettingsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trichoscopy module settings",
  robots: { index: false, follow: false } as const,
};

async function loadAdminFiUser(tenantId: string) {
  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) return null;
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data as { id: string; role: string } | null;
}

export default async function TrichoscopyModuleSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  if (!isHliTrichoscopyPlatformEnabled()) {
    notFound();
  }

  const fiUser = await loadAdminFiUser(tid);
  if (!fiUser) notFound();
  const role = String(fiUser.role ?? "").toLowerCase();
  if (!(HLI_TRICHOSCOPY_SETTINGS_REQUIRED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const supabase = supabaseAdmin();
  const [{ data: entitlement }, { data: config }, { data: usage }, { data: audit }] =
    await Promise.all([
      supabase
        .from("fi_tenant_module_entitlements")
        .select("*")
        .eq("tenant_id", tid)
        .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
        .maybeSingle(),
      supabase
        .from("fi_tenant_module_configurations")
        .select("*")
        .eq("tenant_id", tid)
        .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
        .maybeSingle(),
      supabase
        .from("fi_tenant_module_usage")
        .select("usage_type, quantity, occurred_at")
        .eq("tenant_id", tid)
        .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
        .order("occurred_at", { ascending: false })
        .limit(20),
      supabase
        .from("fi_tenant_module_audit_log")
        .select("event_type, reason, created_at, capability")
        .eq("tenant_id", tid)
        .eq("module_key", HLI_TRICHOSCOPY_MODULE_KEY)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const status = String((entitlement as { status?: string } | null)?.status ?? "not_entitled");
  const tierRaw = (entitlement as { capability_tier?: string } | null)?.capability_tier;
  const tier: TrichoscopyCapabilityTier = isTrichoscopyCapabilityTier(tierRaw)
    ? tierRaw
    : "capture";
  const subscribedCaps =
    ((entitlement as { enabled_capabilities?: string[] } | null)?.enabled_capabilities?.length
      ? (entitlement as { enabled_capabilities: string[] }).enabled_capabilities
      : [...capabilitiesForTier(tier)]) ?? [];
  const settings = ((config as { settings?: TrichoscopyModuleSettings } | null)?.settings ??
    {}) as TrichoscopyModuleSettings;
  const enabled = Boolean((config as { enabled?: boolean } | null)?.enabled);

  async function saveAction(formData: FormData) {
    "use server";
    const actor = await loadAdminFiUser(tid);
    if (!actor) redirect(`/fi-admin/${tid}`);
    const nextEnabled = formData.get("enabled") === "on";
    const nextSettings: TrichoscopyModuleSettings = {
      allowPatientUploads: formData.get("allowPatientUploads") === "on",
      allowClinicCapture: formData.get("allowClinicCapture") === "on",
      allowLongitudinalMonitoring: formData.get("allowLongitudinalMonitoring") === "on",
      allowSurgicalPlanning: formData.get("allowSurgicalPlanning") === "on",
      allowProcedureDayCapture: formData.get("allowProcedureDayCapture") === "on",
      allowPatientReports: formData.get("allowPatientReports") === "on",
      defaultReviewerRole: String(formData.get("defaultReviewerRole") ?? "").trim() || undefined,
      defaultCaptureProtocol: String(formData.get("defaultCaptureProtocol") ?? "").trim() || undefined,
    };
    const result = await setTrichoscopyModuleConfiguration({
      tenantId: tid,
      enabled: nextEnabled,
      settings: nextSettings,
      actorUserId: actor.id,
      disableReason: nextEnabled ? null : "Disabled from module settings",
    });
    if (!result.ok) {
      redirect(
        `/fi-admin/${tid}/settings/modules/trichoscopy?error=${encodeURIComponent(result.message)}`
      );
    }
    redirect(`/fi-admin/${tid}/settings/modules/trichoscopy?saved=1`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <Link
          href={`/fi-admin/${tid}/settings/clinic-setup`}
          className="text-sm text-slate-400 hover:text-slate-100"
        >
          ← Settings
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-100">Trichoscopy Intelligence</h1>
        <p className="mt-1 text-sm text-slate-400">
          Subscription status, capability packaging, and operational activation for this clinic.
        </p>
      </div>

      {status === "not_entitled" ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4">
          <h2 className="font-semibold text-slate-100">Not included in your current subscription</h2>
          <p className="mt-2 text-sm text-slate-400">
            Contact your account representative or upgrade your plan to activate Trichoscopy
            Intelligence.
          </p>
        </div>
      ) : null}

      {status !== "not_entitled" && !enabled ? (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <h2 className="font-semibold text-slate-100">
            Included in your subscription but not yet activated
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Configure protocols and enable the module when staff, devices, and governance are ready.
          </p>
        </div>
      ) : null}

      <dl className="grid gap-3 rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Subscription status</dt>
          <dd className="text-slate-100">{status}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Entitlement tier</dt>
          <dd className="text-slate-100">{tier}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Trial ends</dt>
          <dd className="text-slate-100">
            {(entitlement as { trial_ends_at?: string | null } | null)?.trial_ends_at
              ? new Date(
                  String((entitlement as { trial_ends_at: string }).trial_ends_at)
                ).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Expires</dt>
          <dd className="text-slate-100">
            {(entitlement as { expires_at?: string | null } | null)?.expires_at
              ? new Date(String((entitlement as { expires_at: string }).expires_at)).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Enabled capabilities</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {subscribedCaps.map((c) => (
              <span
                key={c}
                className="rounded border border-white/[0.08] px-2 py-0.5 text-xs text-slate-300"
              >
                {c}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <TrichoscopyModuleSettingsForm
        action={saveAction}
        enabled={enabled}
        settings={settings}
        subscribedCapabilities={subscribedCaps}
      />

      <section>
        <h2 className="text-sm font-semibold text-slate-200">Usage summary</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          {(usage ?? []).length === 0 ? (
            <li>No usage recorded yet.</li>
          ) : (
            (usage as Array<{ usage_type: string; quantity: number; occurred_at: string }>).map(
              (u, i) => (
                <li key={`${u.usage_type}-${i}`}>
                  {u.usage_type} × {u.quantity} · {new Date(u.occurred_at).toLocaleString()}
                </li>
              )
            )
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-200">Recent entitlement changes</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-400">
          {(audit ?? []).length === 0 ? (
            <li>No audit events yet.</li>
          ) : (
            (
              audit as Array<{
                event_type: string;
                reason: string | null;
                created_at: string;
                capability: string | null;
              }>
            ).map((a, i) => (
              <li key={`${a.event_type}-${i}`}>
                {a.event_type}
                {a.capability ? ` · ${a.capability}` : ""}
                {a.reason ? ` — ${a.reason}` : ""} · {new Date(a.created_at).toLocaleString()}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
