"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE } from "@/src/lib/email/emailDeliveryPublicMessages";
import { insertFiTenantAdminAuditEvent } from "@/src/lib/tenantAdmin/tenantAdminAudit.server";
import { logStructured } from "@/src/lib/server/structuredLog";
import { buildFiOsAuthConfirmUrl } from "@/src/lib/supabase/authLinkBootstrap";
import {
  getTenantAdminUsersManageAllowed,
  resolveActorFiUserIdForTenantAdminActions,
} from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";

function firstForwardedValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function getRequestOrigin(): string {
  const h = headers();
  const host = firstForwardedValue(h.get("x-forwarded-host")) ?? h.get("host")?.trim() ?? null;
  const protoRaw = firstForwardedValue(h.get("x-forwarded-proto")) ?? "http";
  const proto = protoRaw.split("/")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return fallback && fallback.length > 0 ? fallback : "http://localhost:3000";
}

function errMsg(e: unknown): string {
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

async function rejectStaffPinForTenantAdminMutation(tenantId: string): Promise<void> {
  await rejectStaffPinSessionForRestrictedMutation(tenantId);
}

const adminRoleSchema = z.enum([
  "clinic_admin",
  "finance_admin",
  "operations_admin",
  "dashboard_viewer",
  "data_safety_admin",
]);

const inviteBodySchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().max(200).optional().nullable(),
  role: adminRoleSchema,
  accessNotes: z.string().max(2000).optional().nullable(),
});

const idBodySchema = z.object({
  tenantId: z.string().uuid(),
  adminUserId: z.string().uuid(),
});

const roleBodySchema = idBodySchema.extend({
  role: adminRoleSchema,
});

export type FiTenantAdminActionResult = { ok: true } | { ok: false; error: string };

export async function inviteTenantAdminUserAction(body: unknown): Promise<FiTenantAdminActionResult> {
  try {
    const parsed = inviteBodySchema.parse(body);
    const tid = parsed.tenantId.trim();
    await rejectStaffPinForTenantAdminMutation(tid);
    if (!(await getTenantAdminUsersManageAllowed(tid))) {
      return { ok: false, error: "You do not have permission to manage admin users for this clinic." };
    }
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tid);
    if (!actorFiUserId) return { ok: false, error: "Could not resolve your clinic user for this action." };

    const email = parsed.email.trim().toLowerCase();
    const supabase = supabaseAdmin();

    const { data: existingUser, error: findErr } = await supabase
      .from("fi_users")
      .select("id, email, auth_user_id, role")
      .eq("tenant_id", tid)
      .ilike("email", email)
      .maybeSingle();
    if (findErr) return { ok: false, error: findErr.message };

    let fiUserId: string;
    if (existingUser) {
      fiUserId = String((existingUser as { id: string }).id);
    } else {
      const { data: created, error: insErr } = await supabase
        .from("fi_users")
        .insert({
          tenant_id: tid,
          email,
          role: "tenant_backend",
          auth_user_id: null,
        })
        .select("id")
        .single();
      if (insErr || !created) return { ok: false, error: insErr?.message ?? "Could not create tenant user row." };
      fiUserId = String((created as { id: string }).id);
    }

    const { data: dup, error: dupErr } = await supabase
      .from("fi_tenant_admin_users")
      .select("id")
      .eq("tenant_id", tid)
      .eq("fi_user_id", fiUserId)
      .maybeSingle();
    if (dupErr) return { ok: false, error: dupErr.message };
    if (dup) return { ok: false, error: "This user is already registered as a tenant admin user." };

    const { data: authRpc, error: rpcErr } = await supabase.rpc("fi_admin_lookup_auth_user_id_by_email", {
      _email: email,
    });
    if (rpcErr) return { ok: false, error: rpcErr.message };
    const rpcAuthId = authRpc ? String(authRpc) : null;

    let authUserId: string | null = existingUser?.auth_user_id
      ? String((existingUser as { auth_user_id: string | null }).auth_user_id)
      : null;
    if (!authUserId) {
      authUserId = rpcAuthId;
    }

    if (!authUserId) {
      const origin = getRequestOrigin().replace(/\/$/, "");
      const nextPath = `/fi-admin/${tid}`;
      const redirectTo = buildFiOsAuthConfirmUrl(origin, nextPath);
      const { data: inv, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          fi_tenant_id: tid,
          fi_role: "tenant_backend",
        },
      });
      if (invErr || !inv.user?.id) {
        logStructured("error", "fi_auth_admin_invite_failed", {
          source: "tenant_admin_invite",
          tenant_id: tid,
          recipient_email_domain: email.includes("@") ? email.split("@")[1]?.toLowerCase() ?? null : null,
          auth_error_message: invErr?.message ?? "invite_missing_user",
          auth_error_name: (invErr as { name?: string } | null)?.name ?? null,
        });
        return { ok: false, error: FI_AUTH_INVITE_EMAIL_PUBLIC_FAILED_MESSAGE };
      }
      authUserId = inv.user.id;
    }

    const userPatch: Record<string, unknown> = {
      email,
      updated_at: new Date().toISOString(),
    };
    if (!existingUser?.auth_user_id) {
      userPatch.auth_user_id = authUserId;
    }
    const { error: linkErr } = await supabase.from("fi_users").update(userPatch).eq("id", fiUserId).eq("tenant_id", tid);
    if (linkErr) return { ok: false, error: linkErr.message };

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
        tenant_id: tid,
        fi_user_id: fiUserId,
        admin_role: parsed.role,
        status,
        display_name: parsed.displayName?.trim() || null,
        access_notes: parsed.accessNotes?.trim() || null,
        invited_by_fi_user_id: actorFiUserId,
      })
      .select("id")
      .single();
    if (admErr || !adminRow) return { ok: false, error: admErr?.message ?? "Could not create admin user profile." };

    await insertFiTenantAdminAuditEvent({
      tenantId: tid,
      eventKind: "admin_user.invited",
      actorFiUserId,
      subjectAdminUserId: String((adminRow as { id: string }).id),
      subjectFiUserId: fiUserId,
      detail: { email, role: parsed.role, status },
    });

    revalidatePath(`/fi-admin/${tid}/settings/admin-users`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateTenantAdminUserRoleAction(body: unknown): Promise<FiTenantAdminActionResult> {
  try {
    const parsed = roleBodySchema.parse(body);
    const tid = parsed.tenantId.trim();
    await rejectStaffPinForTenantAdminMutation(tid);
    if (!(await getTenantAdminUsersManageAllowed(tid))) {
      return { ok: false, error: "You do not have permission to manage admin users for this clinic." };
    }
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tid);
    if (!actorFiUserId) return { ok: false, error: "Could not resolve your clinic user for this action." };

    const supabase = supabaseAdmin();
    const { data: row, error: le } = await supabase
      .from("fi_tenant_admin_users")
      .select("id, admin_role, fi_user_id")
      .eq("tenant_id", tid)
      .eq("id", parsed.adminUserId.trim())
      .maybeSingle();
    if (le || !row) return { ok: false, error: "Admin user not found." };
    const prev = String((row as { admin_role: string }).admin_role);

    const { error: up } = await supabase
      .from("fi_tenant_admin_users")
      .update({
        admin_role: parsed.role,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tid)
      .eq("id", parsed.adminUserId.trim());
    if (up) return { ok: false, error: up.message };

    await insertFiTenantAdminAuditEvent({
      tenantId: tid,
      eventKind: "admin_user.role_changed",
      actorFiUserId,
      subjectAdminUserId: parsed.adminUserId.trim(),
      subjectFiUserId: String((row as { fi_user_id: string }).fi_user_id),
      detail: { from: prev, to: parsed.role },
    });

    revalidatePath(`/fi-admin/${tid}/settings/admin-users`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    return { ok: false, error: errMsg(e) };
  }
}

export async function suspendTenantAdminUserAction(body: unknown): Promise<FiTenantAdminActionResult> {
  try {
    const parsed = idBodySchema.parse(body);
    const tid = parsed.tenantId.trim();
    await rejectStaffPinForTenantAdminMutation(tid);
    if (!(await getTenantAdminUsersManageAllowed(tid))) {
      return { ok: false, error: "You do not have permission to manage admin users for this clinic." };
    }
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tid);
    if (!actorFiUserId) return { ok: false, error: "Could not resolve your clinic user for this action." };

    const supabase = supabaseAdmin();
    const { data: row, error: le } = await supabase
      .from("fi_tenant_admin_users")
      .select("id, fi_user_id")
      .eq("tenant_id", tid)
      .eq("id", parsed.adminUserId.trim())
      .maybeSingle();
    if (le || !row) return { ok: false, error: "Admin user not found." };
    if (String((row as { fi_user_id: string }).fi_user_id) === actorFiUserId) {
      return { ok: false, error: "You cannot suspend your own admin access." };
    }

    const { error: up } = await supabase
      .from("fi_tenant_admin_users")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("tenant_id", tid)
      .eq("id", parsed.adminUserId.trim());
    if (up) return { ok: false, error: up.message };

    await insertFiTenantAdminAuditEvent({
      tenantId: tid,
      eventKind: "admin_user.suspended",
      actorFiUserId,
      subjectAdminUserId: parsed.adminUserId.trim(),
      subjectFiUserId: String((row as { fi_user_id: string }).fi_user_id),
      detail: {},
    });

    revalidatePath(`/fi-admin/${tid}/settings/admin-users`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    return { ok: false, error: errMsg(e) };
  }
}

export async function reactivateTenantAdminUserAction(body: unknown): Promise<FiTenantAdminActionResult> {
  try {
    const parsed = idBodySchema.parse(body);
    const tid = parsed.tenantId.trim();
    await rejectStaffPinForTenantAdminMutation(tid);
    if (!(await getTenantAdminUsersManageAllowed(tid))) {
      return { ok: false, error: "You do not have permission to manage admin users for this clinic." };
    }
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tid);
    if (!actorFiUserId) return { ok: false, error: "Could not resolve your clinic user for this action." };

    const supabase = supabaseAdmin();
    const { data: row, error: le } = await supabase
      .from("fi_tenant_admin_users")
      .select("id, fi_user_id")
      .eq("tenant_id", tid)
      .eq("id", parsed.adminUserId.trim())
      .maybeSingle();
    if (le || !row) return { ok: false, error: "Admin user not found." };

    const fiUserId = String((row as { fi_user_id: string }).fi_user_id);
    let nextStatus: "invited" | "active" = "invited";
    const { data: fu, error: fuErr } = await supabase
      .from("fi_users")
      .select("auth_user_id")
      .eq("tenant_id", tid)
      .eq("id", fiUserId)
      .maybeSingle();
    if (!fuErr && fu) {
      const authUid = String((fu as { auth_user_id: string | null }).auth_user_id ?? "").trim();
      if (authUid) {
        const { data: au, error: auErr } = await supabase.auth.admin.getUserById(authUid);
        if (!auErr && au?.user && (au.user.email_confirmed_at || au.user.last_sign_in_at)) {
          nextStatus = "active";
        }
      }
    }

    const { error: up } = await supabase
      .from("fi_tenant_admin_users")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("tenant_id", tid)
      .eq("id", parsed.adminUserId.trim());
    if (up) return { ok: false, error: up.message };

    await insertFiTenantAdminAuditEvent({
      tenantId: tid,
      eventKind: "admin_user.reactivated",
      actorFiUserId,
      subjectAdminUserId: parsed.adminUserId.trim(),
      subjectFiUserId: fiUserId,
      detail: { status: nextStatus },
    });

    revalidatePath(`/fi-admin/${tid}/settings/admin-users`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Removes the tenant admin access row only. Does not delete `fi_users` or `fi_staff`.
 */
export async function revokeTenantAdminUserAccessAction(body: unknown): Promise<FiTenantAdminActionResult> {
  try {
    const parsed = idBodySchema.parse(body);
    const tid = parsed.tenantId.trim();
    await rejectStaffPinForTenantAdminMutation(tid);
    if (!(await getTenantAdminUsersManageAllowed(tid))) {
      return { ok: false, error: "You do not have permission to manage admin users for this clinic." };
    }
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tid);
    if (!actorFiUserId) return { ok: false, error: "Could not resolve your clinic user for this action." };

    const supabase = supabaseAdmin();
    const { data: row, error: le } = await supabase
      .from("fi_tenant_admin_users")
      .select("id, fi_user_id, admin_role")
      .eq("tenant_id", tid)
      .eq("id", parsed.adminUserId.trim())
      .maybeSingle();
    if (le || !row) return { ok: false, error: "Admin user not found." };
    const fiUserId = String((row as { fi_user_id: string }).fi_user_id);
    if (fiUserId === actorFiUserId) {
      return { ok: false, error: "You cannot revoke your own admin access from this screen." };
    }
    const adminUserId = parsed.adminUserId.trim();
    const prevRole = String((row as { admin_role: string }).admin_role);

    const { data: fu } = await supabase.from("fi_users").select("email").eq("tenant_id", tid).eq("id", fiUserId).maybeSingle();
    const email = fu && typeof (fu as { email: unknown }).email === "string" ? (fu as { email: string }).email : null;

    const { error: delErr } = await supabase.from("fi_tenant_admin_users").delete().eq("tenant_id", tid).eq("id", adminUserId);
    if (delErr) return { ok: false, error: delErr.message };

    await insertFiTenantAdminAuditEvent({
      tenantId: tid,
      eventKind: "admin_user.removed",
      actorFiUserId,
      subjectAdminUserId: null,
      subjectFiUserId: fiUserId,
      detail: { removed_admin_user_id: adminUserId, role: prevRole, email },
    });

    revalidatePath(`/fi-admin/${tid}/settings/admin-users`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    return { ok: false, error: errMsg(e) };
  }
}
