import "server-only";

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { insertFiStaffPinAuditEvent } from "./staffPinAudit.server";
import { STAFF_PIN_SESSION_HOURS } from "./staffPinPolicy";
import type { StaffPinClinicSession } from "./staffPinPermissions";
import { staffPinSessionIsExpired } from "./staffPinPermissions";

export const FI_STAFF_PIN_SESSION_COOKIE = "fi_staff_pin_session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

type SessionRow = {
  id: string;
  tenant_id: string;
  staff_id: string;
  session_token: string;
  staff_full_name: string;
  staff_role: string;
  expires_at: string;
  ended_at: string | null;
};

function toClinicSession(row: SessionRow): StaffPinClinicSession {
  return {
    tenantId: String(row.tenant_id),
    staffId: String(row.staff_id),
    staffName: String(row.staff_full_name),
    staffRole: String(row.staff_role),
    sessionToken: String(row.session_token),
    expiresAt: String(row.expires_at),
  };
}

async function loadActiveSessionRow(sessionToken: string): Promise<SessionRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_pin_sessions")
    .select("id, tenant_id, staff_id, session_token, staff_full_name, staff_role, expires_at, ended_at")
    .eq("session_token", sessionToken.trim())
    .is("ended_at", null)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return data as SessionRow;
}

export async function createStaffPinClinicSession(opts: {
  tenantId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<StaffPinClinicSession> {
  const sessionToken = randomUUID();
  const expiresAt = new Date(Date.now() + STAFF_PIN_SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_staff_pin_sessions").insert({
    tenant_id: opts.tenantId.trim(),
    staff_id: opts.staffId.trim(),
    session_token: sessionToken,
    staff_full_name: opts.staffName.trim(),
    staff_role: opts.staffRole.trim(),
    expires_at: expiresAt,
    client_ip: opts.clientIp ?? null,
    user_agent: opts.userAgent ?? null,
  });
  if (error) throw new Error(error.message);

  await insertFiStaffPinAuditEvent({
    tenantId: opts.tenantId,
    eventKind: "staff_pin.login_success",
    staffId: opts.staffId,
    detail: { expires_at: expiresAt },
  });

  const cookieStore = cookies();
  cookieStore.set(FI_STAFF_PIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_PIN_SESSION_HOURS * 60 * 60,
  });

  return {
    tenantId: opts.tenantId.trim(),
    staffId: opts.staffId.trim(),
    staffName: opts.staffName.trim(),
    staffRole: opts.staffRole.trim(),
    sessionToken,
    expiresAt,
  };
}

export async function getStaffPinClinicSessionIfValid(tenantId?: string): Promise<StaffPinClinicSession | null> {
  try {
    const raw = cookies().get(FI_STAFF_PIN_SESSION_COOKIE)?.value?.trim() ?? "";
    if (!raw || !isUuid(raw)) return null;
    const row = await loadActiveSessionRow(raw);
    if (!row) return null;
    const session = toClinicSession(row);
    if (staffPinSessionIsExpired(session)) {
      await endStaffPinClinicSession(session.sessionToken, session.tenantId, session.staffId);
      return null;
    }
    if (tenantId?.trim() && session.tenantId !== tenantId.trim()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function endStaffPinClinicSession(
  sessionToken: string,
  tenantId?: string,
  staffId?: string
): Promise<void> {
  const token = sessionToken.trim();
  if (!token) return;
  const supabase = supabaseAdmin();
  await supabase
    .from("fi_staff_pin_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("session_token", token)
    .is("ended_at", null);

  if (tenantId && staffId) {
    await insertFiStaffPinAuditEvent({
      tenantId,
      eventKind: "staff_pin.logout",
      staffId,
    });
  }

  try {
    cookies().delete(FI_STAFF_PIN_SESSION_COOKIE);
  } catch {
    // ignore when called outside request context
  }
}

export async function clearStaffPinClinicSessionCookie(): Promise<void> {
  const session = await getStaffPinClinicSessionIfValid();
  if (session) {
    await endStaffPinClinicSession(session.sessionToken, session.tenantId, session.staffId);
    return;
  }
  try {
    cookies().delete(FI_STAFF_PIN_SESSION_COOKIE);
  } catch {
    // ignore
  }
}
