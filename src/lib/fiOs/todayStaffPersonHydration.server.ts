import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  looksLikeEmailLocalPartLabel,
  resolvePersonDisplayNameForToday,
  resolvePersonFirstNameLabel,
  type TodayPersonLabelInput,
} from "@/src/lib/fiOs/todayPersonLabels";

type StaffMemberSourceRow = {
  id: string;
  first_name: string | null;
  full_name: string;
  email: string | null;
  role_code: string | null;
  fi_staff_id: string | null;
};

type FiStaffSourceRow = {
  id: string;
  full_name: string;
  email: string | null;
  staff_role: string | null;
  fi_user_id: string | null;
};

type FiUserSourceRow = {
  id: string;
  email: string | null;
  auth_user_id: string | null;
};

function authMetadataToPersonFields(
  meta: Record<string, unknown> | undefined
): TodayPersonLabelInput {
  if (!meta) return {};
  return {
    first_name: typeof meta.first_name === "string" ? meta.first_name : undefined,
    firstName: typeof meta.firstName === "string" ? meta.firstName : undefined,
    full_name: typeof meta.full_name === "string" ? meta.full_name : undefined,
    fullName: typeof meta.fullName === "string" ? meta.fullName : undefined,
    display_name: typeof meta.display_name === "string" ? meta.display_name : undefined,
    displayName: typeof meta.displayName === "string" ? meta.displayName : undefined,
    name: typeof meta.name === "string" ? meta.name : undefined,
  };
}

function pickStructuredStaffFullName(input: {
  memberFullName: string | null | undefined;
  fiStaffFullName: string | null | undefined;
  authFields: TodayPersonLabelInput;
  email: string | undefined;
}): string | undefined {
  const candidates = [
    input.memberFullName,
    input.fiStaffFullName,
    input.authFields.full_name,
    input.authFields.fullName,
    input.authFields.display_name,
    input.authFields.displayName,
    input.authFields.name,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (looksLikeEmailLocalPartLabel(trimmed, input.email)) continue;
    return trimmed;
  }

  return undefined;
}

function buildStaffPersonLabelInput(input: {
  member: StaffMemberSourceRow;
  fiStaff: FiStaffSourceRow | null;
  fiUser: FiUserSourceRow | null;
  authMeta: Record<string, unknown> | undefined;
}): TodayPersonLabelInput {
  const authFields = authMetadataToPersonFields(input.authMeta);
  const email =
    input.member.email?.trim() ||
    input.fiStaff?.email?.trim() ||
    input.fiUser?.email?.trim() ||
    undefined;
  const structuredFullName = pickStructuredStaffFullName({
    memberFullName: input.member.full_name,
    fiStaffFullName: input.fiStaff?.full_name,
    authFields,
    email,
  });

  return {
    first_name: input.member.first_name ?? authFields.first_name ?? authFields.firstName,
    firstName: input.member.first_name ?? authFields.firstName ?? authFields.first_name,
    full_name: structuredFullName,
    fullName: structuredFullName,
    display_name: structuredFullName,
    displayName: structuredFullName,
    name: structuredFullName,
    email,
    role: input.member.role_code ?? input.fiStaff?.staff_role ?? "staff",
  };
}

async function loadAuthMetadataByUserId(
  authUserIds: string[],
  client: SupabaseClient
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const id of [...new Set(authUserIds.filter(Boolean))]) {
    const { data, error } = await client.auth.admin.getUserById(id);
    if (error || !data?.user) continue;
    const meta = data.user.user_metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      out.set(id, meta as Record<string, unknown>);
    }
  }
  return out;
}

/** Batch-hydrates staff member profile fields for Today person-label resolution. */
export async function loadStaffMemberPersonProfilesForToday(
  tenantId: string,
  staffMemberIds: string[],
  client: SupabaseClient = supabaseAdmin()
): Promise<Map<string, TodayPersonLabelInput>> {
  const tid = tenantId.trim();
  const ids = [...new Set(staffMemberIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, TodayPersonLabelInput>();
  if (!ids.length) return out;

  const { data: memberRows, error: memberErr } = await client
    .from("fi_staff_members")
    .select("id, first_name, full_name, email, role_code, fi_staff_id")
    .eq("tenant_id", tid)
    .in("id", ids);
  if (memberErr) throw new Error(memberErr.message);

  const members = (memberRows ?? []) as StaffMemberSourceRow[];
  const fiStaffIds = [
    ...new Set(members.map((m) => m.fi_staff_id).filter((x): x is string => Boolean(x?.trim()))),
  ];

  const fiStaffById = new Map<string, FiStaffSourceRow>();
  if (fiStaffIds.length) {
    const { data, error } = await client
      .from("fi_staff")
      .select("id, full_name, email, staff_role, fi_user_id")
      .eq("tenant_id", tid)
      .in("id", fiStaffIds);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const row = raw as FiStaffSourceRow;
      fiStaffById.set(String(row.id), row);
    }
  }

  const fiUserIds = [
    ...new Set(
      [...fiStaffById.values()]
        .map((s) => s.fi_user_id)
        .filter((x): x is string => Boolean(x?.trim()))
    ),
  ];

  const fiUserById = new Map<string, FiUserSourceRow>();
  if (fiUserIds.length) {
    const { data, error } = await client
      .from("fi_users")
      .select("id, email, auth_user_id")
      .eq("tenant_id", tid)
      .in("id", fiUserIds);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const row = raw as FiUserSourceRow;
      fiUserById.set(String(row.id), row);
    }
  }

  const authUserIds = [
    ...new Set(
      [...fiUserById.values()]
        .map((u) => u.auth_user_id)
        .filter((x): x is string => Boolean(x?.trim()))
    ),
  ];
  const authMetaByUserId = await loadAuthMetadataByUserId(authUserIds, client);

  for (const member of members) {
    const fiStaff = member.fi_staff_id
      ? (fiStaffById.get(String(member.fi_staff_id)) ?? null)
      : null;
    const fiUser = fiStaff?.fi_user_id
      ? (fiUserById.get(String(fiStaff.fi_user_id)) ?? null)
      : null;
    const authMeta = fiUser?.auth_user_id
      ? authMetaByUserId.get(String(fiUser.auth_user_id))
      : undefined;

    out.set(String(member.id), buildStaffPersonLabelInput({ member, fiStaff, fiUser, authMeta }));
  }

  return out;
}

export function resolveStaffPersonDisplayNameForToday(profile: TodayPersonLabelInput): string {
  return (
    resolvePersonDisplayNameForToday(profile, { defaultLabel: "Staff member" }) || "Staff member"
  );
}

export function resolveStaffPersonFirstNameForToday(profile: TodayPersonLabelInput): string {
  return resolvePersonFirstNameLabel(profile, { defaultLabel: "Staff member" });
}

/** Resolves viewer display name from tenant staff profile chain, then auth metadata. */
export async function loadStaffPersonProfileForAuthUserInTenant(
  tenantId: string,
  authUserId: string,
  client: SupabaseClient = supabaseAdmin()
): Promise<TodayPersonLabelInput | null> {
  const tid = tenantId.trim();
  const aid = authUserId.trim();
  if (!tid || !aid) return null;

  const { data: fiUser, error: fiUserErr } = await client
    .from("fi_users")
    .select("id, email, auth_user_id")
    .eq("tenant_id", tid)
    .eq("auth_user_id", aid)
    .maybeSingle();
  if (fiUserErr) throw new Error(fiUserErr.message);
  if (!fiUser) return null;

  const fiUserRow = fiUser as FiUserSourceRow;
  const { data: fiStaff, error: fiStaffErr } = await client
    .from("fi_staff")
    .select("id, full_name, email, staff_role, fi_user_id")
    .eq("tenant_id", tid)
    .eq("fi_user_id", fiUserRow.id)
    .maybeSingle();
  if (fiStaffErr) throw new Error(fiStaffErr.message);

  let member: StaffMemberSourceRow | null = null;
  if (fiStaff) {
    const fiStaffRow = fiStaff as FiStaffSourceRow;
    const { data: memberRow, error: memberErr } = await client
      .from("fi_staff_members")
      .select("id, first_name, full_name, email, role_code, fi_staff_id")
      .eq("tenant_id", tid)
      .eq("fi_staff_id", fiStaffRow.id)
      .is("merged_into", null)
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    member = (memberRow as StaffMemberSourceRow | null) ?? null;
  }

  const { data: authData, error: authErr } = await client.auth.admin.getUserById(aid);
  if (authErr) throw new Error(authErr.message);
  const authMeta =
    authData.user?.user_metadata &&
    typeof authData.user.user_metadata === "object" &&
    !Array.isArray(authData.user.user_metadata)
      ? (authData.user.user_metadata as Record<string, unknown>)
      : undefined;

  if (member) {
    return buildStaffPersonLabelInput({
      member,
      fiStaff: (fiStaff as FiStaffSourceRow | null) ?? null,
      fiUser: fiUserRow,
      authMeta,
    });
  }

  return {
    ...authMetadataToPersonFields(authMeta),
    email: authData.user?.email?.trim() || fiUserRow.email?.trim() || undefined,
    full_name: (fiStaff as FiStaffSourceRow | null)?.full_name?.trim() || undefined,
    display_name: (fiStaff as FiStaffSourceRow | null)?.full_name?.trim() || undefined,
    role: (fiStaff as FiStaffSourceRow | null)?.staff_role ?? undefined,
  };
}
