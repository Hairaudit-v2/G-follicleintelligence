import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  decryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
} from "@/src/lib/onboarding-os/externalConnectorSecretCrypto.server";

import {
  buildStaffCalendarLinkIndex,
  staffCalendarLinkToClientRow,
  type CreateStaffCalendarLinkInput,
  type StaffCalendarLinkClientRow,
  type StaffCalendarLinkLookupRow,
  type StaffCalendarLinkPageModel,
  type UpdateStaffCalendarLinkInput,
} from "./googleCalendarProviderLinksCore";

export type {
  CreateStaffCalendarLinkInput,
  StaffCalendarLinkClientRow,
  StaffCalendarLinkPageModel,
  UpdateStaffCalendarLinkInput,
} from "./googleCalendarProviderLinksCore";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

type StaffCalendarLinkRow = {
  id: string;
  tenant_id: string;
  staff_member_id: string;
  provider: string;
  calendar_id: string;
  calendar_label: string | null;
  google_account_email: string | null;
  timely_ics_url_encrypted: string | null;
  source_system: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const LINK_SELECT =
  "id, tenant_id, staff_member_id, provider, calendar_id, calendar_label, google_account_email, timely_ics_url_encrypted, source_system, status, metadata, created_at, updated_at";

function resolveMasterKey(): Buffer | null {
  return deriveExternalConnectorMasterKey(process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY);
}

function encryptTimelyIcsUrl(plaintext: string): string {
  const key = resolveMasterKey();
  if (!key) throw new Error("FI_EXTERNAL_CONNECTOR_MASTER_KEY is not configured.");
  return encryptExternalConnectorSecret(plaintext.trim(), key);
}

function decryptTimelyIcsUrlForServerUse(encrypted: string): string {
  const key = resolveMasterKey();
  if (!key) throw new Error("FI_EXTERNAL_CONNECTOR_MASTER_KEY is not configured.");
  return decryptExternalConnectorSecret(encrypted, key);
}

async function loadStaffNameMap(
  tenantId: string,
  staffIds: string[],
  client: SupabaseClient
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(staffIds.map((id) => id.trim()).filter(Boolean)));
  const out = new Map<string, string>();
  if (!ids.length) return out;

  const { data, error } = await client
    .from("fi_staff")
    .select("id, full_name")
    .eq("tenant_id", tenantId.trim())
    .in("id", ids);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const r = raw as { id: string; full_name: string | null };
    out.set(String(r.id), String(r.full_name ?? "").trim() || "Staff");
  }
  return out;
}

async function assertStaffBelongsToTenant(
  tenantId: string,
  staffMemberId: string,
  client: SupabaseClient
): Promise<void> {
  const { data, error } = await client
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", staffMemberId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Staff member not found for this tenant.");
}

export async function createStaffCalendarLink(
  input: CreateStaffCalendarLinkInput,
  opts: ServerOpts = {}
): Promise<StaffCalendarLinkClientRow> {
  const client = opts.supabaseClientForTests ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const staffMemberId = input.staffMemberId.trim();
  const calendarId = input.calendarId.trim();
  const provider = (input.provider ?? "google").trim().toLowerCase();

  if (!tid || !staffMemberId || !calendarId) {
    throw new Error("tenantId, staffMemberId, and calendarId are required.");
  }

  await assertStaffBelongsToTenant(tid, staffMemberId, client);

  const row: Record<string, unknown> = {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    provider,
    calendar_id: calendarId,
    calendar_label: input.calendarLabel?.trim() || null,
    google_account_email: input.googleAccountEmail?.trim() || null,
    source_system: input.sourceSystem?.trim() || (provider === "timely" ? "timely_ics" : "google_calendar"),
    status: "active",
    metadata: input.metadata ?? {},
  };

  const icsUrl = input.timelyIcsUrl?.trim();
  if (icsUrl) {
    row.timely_ics_url_encrypted = encryptTimelyIcsUrl(icsUrl);
  }

  const { data, error } = await client
    .from("fi_staff_calendar_links")
    .upsert(row, { onConflict: "tenant_id,provider,calendar_id" })
    .select(LINK_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const linkRow = data as StaffCalendarLinkRow;
  const staffNames = await loadStaffNameMap(tid, [linkRow.staff_member_id], client);
  return staffCalendarLinkToClientRow(linkRow, staffNames.get(linkRow.staff_member_id) ?? "Staff");
}

export async function updateStaffCalendarLink(
  input: UpdateStaffCalendarLinkInput,
  opts: ServerOpts = {}
): Promise<StaffCalendarLinkClientRow> {
  const client = opts.supabaseClientForTests ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const linkId = input.linkId.trim();
  if (!tid || !linkId) throw new Error("tenantId and linkId are required.");

  const patch: Record<string, unknown> = {};
  if (input.staffMemberId?.trim()) {
    await assertStaffBelongsToTenant(tid, input.staffMemberId.trim(), client);
    patch.staff_member_id = input.staffMemberId.trim();
  }
  if (input.calendarLabel !== undefined) patch.calendar_label = input.calendarLabel?.trim() || null;
  if (input.googleAccountEmail !== undefined) patch.google_account_email = input.googleAccountEmail?.trim() || null;
  if (input.status) patch.status = input.status;
  if (input.metadata) patch.metadata = input.metadata;

  const icsUrl = input.timelyIcsUrl?.trim();
  if (icsUrl) {
    patch.timely_ics_url_encrypted = encryptTimelyIcsUrl(icsUrl);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No fields to update.");
  }

  const { data, error } = await client
    .from("fi_staff_calendar_links")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", linkId)
    .select(LINK_SELECT)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Calendar link not found.");

  const linkRow = data as StaffCalendarLinkRow;
  const staffNames = await loadStaffNameMap(tid, [linkRow.staff_member_id], client);
  return staffCalendarLinkToClientRow(linkRow, staffNames.get(linkRow.staff_member_id) ?? "Staff");
}

export async function deactivateStaffCalendarLink(
  tenantId: string,
  linkId: string,
  opts: ServerOpts = {}
): Promise<StaffCalendarLinkClientRow> {
  return updateStaffCalendarLink({ tenantId, linkId, status: "inactive" }, opts);
}

export async function loadStaffCalendarLinks(
  tenantId: string,
  opts: ServerOpts & { includeInactive?: boolean } = {}
): Promise<StaffCalendarLinkClientRow[]> {
  const client = opts.supabaseClientForTests ?? supabaseAdmin();
  const tid = tenantId.trim();
  if (!tid) return [];

  let query = client.from("fi_staff_calendar_links").select(LINK_SELECT).eq("tenant_id", tid);
  if (!opts.includeInactive) {
    query = query.eq("status", "active");
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as StaffCalendarLinkRow[];
  const staffNames = await loadStaffNameMap(
    tid,
    rows.map((r) => r.staff_member_id),
    client
  );

  return rows.map((row) =>
    staffCalendarLinkToClientRow(row, staffNames.get(row.staff_member_id) ?? "Staff")
  );
}

export async function loadStaffCalendarLinkLookups(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<StaffCalendarLinkLookupRow[]> {
  const client = opts.supabaseClientForTests ?? supabaseAdmin();
  const tid = tenantId.trim();
  if (!tid) return [];

  const { data, error } = await client
    .from("fi_staff_calendar_links")
    .select("id, tenant_id, staff_member_id, provider, calendar_id, status")
    .eq("tenant_id", tid)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  return ((data ?? []) as StaffCalendarLinkLookupRow[]).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    provider: row.provider,
    calendar_id: row.calendar_id,
    status: row.status,
  }));
}

export async function loadActiveStaffCalendarLinkIndex(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<Map<string, StaffCalendarLinkLookupRow>> {
  const links = await loadStaffCalendarLinkLookups(tenantId, opts);
  return buildStaffCalendarLinkIndex(links, tenantId);
}

export async function loadProviderCalendarLinksPage(
  tenantId: string,
  opts: ServerOpts & { canManage?: boolean } = {}
): Promise<StaffCalendarLinkPageModel> {
  const client = opts.supabaseClientForTests ?? supabaseAdmin();
  const tid = tenantId.trim();

  const [links, staffResult] = await Promise.all([
    loadStaffCalendarLinks(tid, { ...opts, includeInactive: true }),
    client
      .from("fi_staff")
      .select("id, full_name")
      .eq("tenant_id", tid)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (staffResult.error) throw new Error(staffResult.error.message);

  const staffOptions = (staffResult.data ?? []).map((raw) => {
    const r = raw as { id: string; full_name: string | null };
    return {
      id: String(r.id),
      fullName: String(r.full_name ?? "").trim() || "Staff",
    };
  });

  return {
    tenantId: tid,
    links,
    staffOptions,
    canManage: opts.canManage ?? false,
  };
}

export function decryptStaffCalendarLinkTimelyIcsUrl(encrypted: string): string {
  return decryptTimelyIcsUrlForServerUse(encrypted);
}

export {
  buildStaffCalendarLinkIndex,
  findStaffForCalendarEvent,
  resolveCalendarEventStaffAssignment,
} from "./googleCalendarProviderLinksCore";
