import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantConfig } from "@/lib/fi/tenantConfig";
import { FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE } from "@/src/lib/email/emailDeliveryPublicMessages";
import { logStructured } from "@/src/lib/server/structuredLog";
import { insertFiTenantAdminAuditEvent } from "@/src/lib/tenantAdmin/tenantAdminAudit.server";
import { buildFiOsAuthConfirmUrl } from "@/src/lib/supabase/authLinkBootstrap";

function firstForwardedValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export function getRequestOriginFromHeaders(getHeader: (name: string) => string | null): string {
  const host =
    firstForwardedValue(getHeader("x-forwarded-host")) ?? getHeader("host")?.trim() ?? null;
  const protoRaw = firstForwardedValue(getHeader("x-forwarded-proto")) ?? "http";
  const proto = protoRaw.split("/")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return fallback && fallback.length > 0 ? fallback : "http://localhost:3000";
}

export type PlatformTenantProvisionInput = {
  /** Authenticated platform admin (auth.users id) — used for structured logs only. */
  actorAuthUserId: string;
  tenantName: string;
  tenantSlug: string;
  defaultClinicDisplayName: string;
  defaultTimezone: string;
  firstTenantAdminEmail: string;
  /** Optional branding overrides (fi_tenant_settings + config_json.branding). */
  supportEmail?: string | null;
};

export type PlatformTenantProvisionResult =
  | { ok: true; tenantId: string; clinicId: string; fiUserId: string; tenantAdminUserId: string }
  | { ok: false; error: string };

/**
 * Creates `fi_tenants`, default `fi_clinics`, `fi_tenant_settings`, default `config_json` (branding + feature_flags),
 * first `fi_users` + `fi_tenant_admin_users` (clinic_admin) by email, tenant admin audit row, and a structured log line.
 * All writes use the service-role client from trusted server code only.
 */
export async function provisionPlatformTenant(
  input: PlatformTenantProvisionInput,
  opts: { getHeader: (name: string) => string | null }
): Promise<PlatformTenantProvisionResult> {
  const supabase = supabaseAdmin();
  const email = input.firstTenantAdminEmail.trim().toLowerCase();
  const slug = input.tenantSlug.trim().toLowerCase();
  const tenantName = input.tenantName.trim();
  const clinicName = input.defaultClinicDisplayName.trim();
  const tz = input.defaultTimezone.trim();

  if (!tenantName) return { ok: false, error: "Tenant name is required." };
  if (!slug) return { ok: false, error: "Tenant slug is required." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      error:
        "Slug must use lowercase letters, digits, and single hyphens between segments (e.g. acme-clinic).",
    };
  }
  if (!clinicName) return { ok: false, error: "Default clinic display name is required." };
  if (!tz || tz.length > 120)
    return { ok: false, error: "Default timezone is required (max 120 characters)." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid first tenant admin email is required." };
  }

  const resolved = resolveTenantConfig(null);
  const primaryHex = resolved.branding?.primary_color?.trim() || "#C6A75E";
  const secondaryHex = resolved.branding?.secondary_color?.trim() || "#0F1B2D";
  const support =
    (input.supportEmail?.trim() || "").length > 0
      ? input.supportEmail!.trim()
      : `support@${slug}.local`;

  let tenantId: string | null = null;
  try {
    const { data: tRow, error: tErr } = await supabase
      .from("fi_tenants")
      .insert({ name: tenantName, slug })
      .select("id")
      .single();
    if (tErr || !tRow) {
      if (tErr?.code === "23505")
        return { ok: false, error: "A tenant with this slug already exists." };
      return { ok: false, error: tErr?.message ?? "Could not create tenant." };
    }
    tenantId = String((tRow as { id: string }).id);

    const { data: cRow, error: cErr } = await supabase
      .from("fi_clinics")
      .insert({ tenant_id: tenantId, display_name: clinicName, metadata: {} })
      .select("id")
      .single();
    if (cErr || !cRow) throw new Error(cErr?.message ?? "Could not create default clinic.");
    const clinicId = String((cRow as { id: string }).id);

    const now = new Date().toISOString();
    const { error: sErr } = await supabase.from("fi_tenant_settings").upsert(
      {
        tenant_id: tenantId,
        brand_name: tenantName,
        default_timezone: tz,
        primary_colour: primaryHex,
        secondary_colour: secondaryHex,
        accent_colour: primaryHex,
        support_email: support,
        updated_at: now,
      },
      { onConflict: "tenant_id" }
    );
    if (sErr) throw new Error(sErr.message);

    const { error: cfgErr } = await supabase
      .from("fi_tenants")
      .update({
        config_json: {
          branding: resolved.branding ?? {},
          feature_flags: resolved.feature_flags ?? {},
        },
        updated_at: now,
      })
      .eq("id", tenantId);
    if (cfgErr) throw new Error(cfgErr.message);

    const { data: existingUser, error: findErr } = await supabase
      .from("fi_users")
      .select("id, email, auth_user_id, role")
      .eq("tenant_id", tenantId)
      .ilike("email", email)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    let fiUserId: string;
    if (existingUser) {
      fiUserId = String((existingUser as { id: string }).id);
    } else {
      const { data: created, error: insErr } = await supabase
        .from("fi_users")
        .insert({
          tenant_id: tenantId,
          email,
          role: "tenant_backend",
          auth_user_id: null,
        })
        .select("id")
        .single();
      if (insErr || !created)
        throw new Error(insErr?.message ?? "Could not create tenant user row.");
      fiUserId = String((created as { id: string }).id);
    }

    const { data: dup, error: dupErr } = await supabase
      .from("fi_tenant_admin_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("fi_user_id", fiUserId)
      .maybeSingle();
    if (dupErr) throw new Error(dupErr.message);
    if (dup) throw new Error("This user is already registered as a tenant admin user.");

    const { data: authRpc, error: rpcErr } = await supabase.rpc(
      "fi_admin_lookup_auth_user_id_by_email",
      {
        _email: email,
      }
    );
    if (rpcErr) throw new Error(rpcErr.message);
    const rpcAuthId = authRpc ? String(authRpc) : null;

    let authUserId: string | null = existingUser?.auth_user_id
      ? String((existingUser as { auth_user_id: string | null }).auth_user_id)
      : null;
    if (!authUserId) {
      authUserId = rpcAuthId;
    }

    if (!authUserId) {
      const origin = getRequestOriginFromHeaders(opts.getHeader).replace(/\/$/, "");
      const nextPath = `/fi-admin/${tenantId}`;
      const redirectTo = buildFiOsAuthConfirmUrl(origin, nextPath);
      const { data: inv, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          fi_tenant_id: tenantId,
          fi_role: "tenant_backend",
        },
      });
      if (invErr || !inv.user?.id) {
        logStructured("error", "fi_auth_admin_invite_failed", {
          source: "platform_tenant_provision",
          tenant_slug: slug,
          recipient_email_domain: email.includes("@")
            ? (email.split("@")[1]?.toLowerCase() ?? null)
            : null,
          auth_error_message: invErr?.message ?? "invite_missing_user",
          auth_error_name: (invErr as { name?: string } | null)?.name ?? null,
        });
        throw new Error(FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE);
      }
      authUserId = inv.user.id;
    }

    const userPatch: Record<string, unknown> = {
      email,
      updated_at: new Date().toISOString(),
    };
    if (!(existingUser as { auth_user_id?: string | null } | null)?.auth_user_id) {
      userPatch.auth_user_id = authUserId;
    }
    const { error: linkErr } = await supabase
      .from("fi_users")
      .update(userPatch)
      .eq("id", fiUserId)
      .eq("tenant_id", tenantId);
    if (linkErr) throw new Error(linkErr.message);

    let status: "invited" | "active" = "invited";
    if (authUserId) {
      const { data: au, error: auErr } = await supabase.auth.admin.getUserById(authUserId);
      if (!auErr && au.user && (au.user.email_confirmed_at || au.user.last_sign_in_at)) {
        status = "active";
      }
    }

    const { data: adminRow, error: admErr } = await supabase
      .from("fi_tenant_admin_users")
      .insert({
        tenant_id: tenantId,
        fi_user_id: fiUserId,
        admin_role: "clinic_admin",
        status,
        display_name: null,
        access_notes: "Created during platform tenant provisioning.",
        invited_by_fi_user_id: null,
      })
      .select("id")
      .single();
    if (admErr || !adminRow)
      throw new Error(admErr?.message ?? "Could not create tenant admin user profile.");
    const tenantAdminUserId = String((adminRow as { id: string }).id);

    await insertFiTenantAdminAuditEvent({
      tenantId,
      eventKind: "admin_user.invited",
      actorFiUserId: null,
      subjectAdminUserId: tenantAdminUserId,
      subjectFiUserId: fiUserId,
      detail: { email, role: "clinic_admin", status, source: "platform_tenant_provision" },
    });

    logStructured("info", "fi_platform_tenant_provisioned", {
      tenant_id: tenantId,
      clinic_id: clinicId,
      actor_auth_user_id: input.actorAuthUserId,
    });

    return { ok: true, tenantId, clinicId, fiUserId, tenantAdminUserId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (tenantId) {
      const { error: delErr } = await supabase.from("fi_tenants").delete().eq("id", tenantId);
      if (delErr) {
        logStructured("error", "fi_platform_tenant_provision_rollback_failed", {
          tenant_id: tenantId,
          message: delErr.message,
        });
      }
    }
    logStructured("warn", "fi_platform_tenant_provision_failed", {
      tenant_slug: slug,
      actor_auth_user_id: input.actorAuthUserId,
      message: msg,
    });
    return { ok: false, error: msg };
  }
}
