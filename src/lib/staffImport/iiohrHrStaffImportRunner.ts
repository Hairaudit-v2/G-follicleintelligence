/**
 * IIOHR HR staff import runner: planning + optional DB apply via Supabase service role.
 * Safe for CLI (`tsx`) — no `server-only` or Next-only imports.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isCrmStaffManageRole } from "@/src/lib/crm/crmGatePolicy";
import { isFiAdminApiKeyMatch } from "@/src/lib/crm/crmFiAdminApiKeyMatch";
import { normalizeFiOsRole } from "@/src/lib/fiOs/fiOsRoles";
import {
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceStaffId,
  normalizeFiStaffSourceSystem,
} from "@/src/lib/staff/staffSourceIdsNormalize";
import {
  IIOHR_HR_SOURCE_SYSTEM,
  planIiohrHrStaffImport,
} from "@/src/lib/staffImport/iiohrHrStaffImportPlan";
import type {
  IiohrHrStaffImportAction,
  IiohrHrStaffImportPlanResult,
  IiohrHrStaffImportRow,
} from "@/src/lib/staffImport/iiohrHrStaffImportTypes";

const HR_IMPORT_PRIMARY_CLINIC_META_KEY = "primary_fi_clinic_id";

/**
 * Resolves a Perth clinic row for Evolved HR imports: prefers exact
 * "Evolved Hair Restoration Perth", then name containing Perth + Evolved/Hair/Restoration, then any "Perth".
 */
export type EvolvedHrPerthClinicPick = { clinicId: string | null; displayName: string | null };

/**
 * Resolves a Perth clinic row for Evolved HR imports: prefers exact
 * "Evolved Hair Restoration Perth", then name containing Perth + Evolved/Hair/Restoration, then any "Perth".
 */
export async function resolveEvolvedHrPerthClinicForTenant(
  tenantId: string
): Promise<EvolvedHrPerthClinicPick> {
  try {
    const tid = assertNonEmptyUuid(tenantId, "tenantId");
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_clinics")
      .select("id, display_name")
      .eq("tenant_id", tid);
    if (error) return { clinicId: null, displayName: null };
    const rows = (data ?? []) as { id: string; display_name: string }[];
    const lower = (s: string) => s.trim().toLowerCase();
    const pick = (r: { id: string; display_name: string }) => ({
      clinicId: String(r.id),
      displayName: String(r.display_name ?? "").trim() || null,
    });
    const exact = rows.find((r) => lower(r.display_name) === "evolved hair restoration perth");
    if (exact) return pick(exact);
    const evolvedPerth = rows.find((r) => {
      const d = lower(r.display_name);
      return (
        d.includes("perth") &&
        (d.includes("evolved") || d.includes("restoration") || d.includes("hair"))
      );
    });
    if (evolvedPerth) return pick(evolvedPerth);
    const anyPerth = rows.find((r) => lower(r.display_name).includes("perth"));
    return anyPerth ? pick(anyPerth) : { clinicId: null, displayName: null };
  } catch {
    return { clinicId: null, displayName: null };
  }
}

/** Mutates plan: tags `iiohr_hr` source-id actions with `primary_fi_clinic_id` when a Perth clinic exists; otherwise appends a warning. */
export function attachEvolvedPerthClinicMetadataToPlan(
  plan: IiohrHrStaffImportPlanResult,
  clinicId: string | null
): void {
  if (!clinicId) {
    plan.warnings.push(
      "No Perth clinic record matched for this tenant (expected a clinic name including “Perth”, e.g. Evolved Hair Restoration Perth). Staff are imported at tenant level only — add or rename a Perth clinic in Foundation to link HR imports."
    );
    return;
  }
  for (const pr of plan.perRow) {
    for (const a of pr.actions) {
      if (a.type === "create_staff_source_id") {
        if (normalizeFiStaffSourceSystem(a.payload.source_system) !== IIOHR_HR_SOURCE_SYSTEM)
          continue;
        a.payload.metadata = normalizeFiStaffSourceMetadata({
          ...normalizeFiStaffSourceMetadata(a.payload.metadata),
          [HR_IMPORT_PRIMARY_CLINIC_META_KEY]: clinicId,
        });
      } else if (a.type === "update_staff_source_id") {
        const base =
          a.payload.metadata != null ? normalizeFiStaffSourceMetadata(a.payload.metadata) : {};
        a.payload.metadata = normalizeFiStaffSourceMetadata({
          ...base,
          [HR_IMPORT_PRIMARY_CLINIC_META_KEY]: clinicId,
        });
      }
    }
  }
  plan.actions = plan.perRow.flatMap((p) => p.actions);
}

const tenantIdSchema = z.string().uuid("tenantId must be a UUID.");

const iiohrHrStaffImportRowSchema = z.object({
  external_staff_id: z.coerce.string(),
  iiohr_user_id: z.union([z.string(), z.number()]).nullable().optional(),
  email: z.union([z.string(), z.null()]).optional(),
  full_name: z.coerce.string(),
  staff_role: z.union([z.string(), z.null()]).optional(),
  employment_status: z.union([z.string(), z.null()]).optional(),
  source_url: z.union([z.string(), z.null()]).optional(),
  default_timezone: z.union([z.string(), z.null()]).optional(),
  working_hours: z.record(z.unknown()).nullable().optional(),
});

export type IiohrHrStaffImportCounts = {
  createdUsers: number;
  updatedUsers: number;
  createdStaff: number;
  updatedStaff: number;
  linkedStaff: number;
  deactivatedStaff: number;
  createdSourceIds: number;
  updatedSourceIds: number;
};

export type IiohrHrStaffImportRunResult = {
  ok: boolean;
  commit: boolean;
  validationErrors: string[];
  warnings: string[];
  skippedRowCount: number;
  plan: IiohrHrStaffImportPlanResult;
  dryRunCounts: IiohrHrStaffImportCounts;
  appliedCounts?: IiohrHrStaffImportCounts;
  error?: string;
  /** Rows accepted after per-row schema validation (same order as planner input). Omitted when tenant parse fails before validation. */
  validatedPackedRows?: IiohrHrStaffImportRow[];
};

type FiStaffUpsertInput = {
  full_name: string;
  staff_role?: string;
  email?: string | null;
  mobile?: string | null;
  default_timezone?: string | null;
  working_hours?: Record<string, unknown>;
  is_active?: boolean;
  calendar_color?: string | null;
  fi_user_id?: string | null;
};

function emptyCounts(): IiohrHrStaffImportCounts {
  return {
    createdUsers: 0,
    updatedUsers: 0,
    createdStaff: 0,
    updatedStaff: 0,
    linkedStaff: 0,
    deactivatedStaff: 0,
    createdSourceIds: 0,
    updatedSourceIds: 0,
  };
}

function countFromActions(actions: IiohrHrStaffImportAction[]): IiohrHrStaffImportCounts {
  const c = emptyCounts();
  for (const a of actions) {
    switch (a.type) {
      case "create_fi_user":
        c.createdUsers += 1;
        break;
      case "update_fi_user":
        c.updatedUsers += 1;
        break;
      case "create_fi_staff":
        c.createdStaff += 1;
        break;
      case "update_fi_staff":
        c.updatedStaff += 1;
        break;
      case "link_staff_to_user":
        c.linkedStaff += 1;
        break;
      case "deactivate_staff":
        c.deactivatedStaff += 1;
        break;
      case "create_staff_source_id":
        c.createdSourceIds += 1;
        break;
      case "update_staff_source_id":
        c.updatedSourceIds += 1;
        break;
      case "skip_row":
        break;
      default:
        break;
    }
  }
  return c;
}

function emptyPlan(): IiohrHrStaffImportPlanResult {
  return { perRow: [], actions: [], warnings: [], validationIssues: [] };
}

async function assertTenantExists(tenantId: string): Promise<void> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_tenants")
    .select("id")
    .eq("id", tid)
    .maybeSingle();
  if (error) throw new Error("Could not verify tenant.");
  if (!data) throw new Error("Tenant not found.");
}

/**
 * `FI_ADMIN_API_KEY`, tenant `admin` / `fi_admin`, or platform `fi_os_identities.fi_admin`.
 * Pass `authUserId` from `resolveAuthUserId` in Next.js server actions (cookies session).
 */
export async function assertIiohrHrStaffImportAllowed(opts: {
  tenantId: string;
  adminKey?: string | null;
  authUserId?: string | null;
}): Promise<void> {
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new Error("tenantId is required.");

  if (isFiAdminApiKeyMatch(opts.adminKey ?? undefined, process.env.FI_ADMIN_API_KEY)) {
    await assertTenantExists(tenantId);
    return;
  }

  const authUserId = opts.authUserId?.trim() || null;
  if (!authUserId) throw new Error("Authentication required.");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error("Could not verify tenant membership.");
  if (data && isCrmStaffManageRole((data as { role: string | null }).role)) {
    return;
  }

  const { data: osRow, error: osErr } = await supabase
    .from("fi_os_identities")
    .select("os_role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (osErr) throw new Error("Could not verify OS identity.");
  const raw = (osRow as { os_role: string | null } | null)?.os_role;
  if (normalizeFiOsRole(raw) === "fi_admin" || normalizeFiOsRole(raw) === "fi_platform_admin") {
    return;
  }

  throw new Error("Admin role required for IIOHR HR staff import.");
}

function validateImportRows(rows: unknown): {
  rows: IiohrHrStaffImportRow[];
  sourceRowIndices: number[];
  validationErrors: string[];
} {
  const validationErrors: string[] = [];
  if (!Array.isArray(rows)) {
    validationErrors.push("Body must include a JSON array `rows`.");
    return { rows: [], sourceRowIndices: [], validationErrors };
  }
  const candidates: IiohrHrStaffImportRow[] = [];
  const sourceRowIndices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = iiohrHrStaffImportRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid row.";
      validationErrors.push(`Row ${i}: ${msg}`);
      continue;
    }
    const r = parsed.data;
    candidates.push({
      external_staff_id: String(r.external_staff_id).trim(),
      iiohr_user_id: r.iiohr_user_id != null ? String(r.iiohr_user_id).trim() : null,
      email:
        r.email != null && String(r.email).trim() ? String(r.email).trim().toLowerCase() : null,
      full_name: String(r.full_name ?? "").trim(),
      staff_role: r.staff_role != null ? String(r.staff_role).trim() : null,
      employment_status: r.employment_status != null ? String(r.employment_status).trim() : null,
      source_url: r.source_url != null ? String(r.source_url) : undefined,
      default_timezone: r.default_timezone != null ? String(r.default_timezone).trim() : undefined,
      working_hours: r.working_hours ?? undefined,
    });
    sourceRowIndices.push(i);
  }
  return { rows: candidates, sourceRowIndices, validationErrors };
}

async function assertFiUserBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<void> {
  const tid = tenantId.trim();
  const uid = fiUserId.trim();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("fi_user_id must be a fi_users row in this tenant.");
}

async function assertFiStaffBelongsToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  staffId: string
): Promise<void> {
  const tid = tenantId.trim();
  const sid = staffId.trim();
  const { data, error } = await supabase
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tid)
    .eq("id", sid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Staff id must belong to the tenant.");
}

async function insertFiStaffRow(
  supabase: SupabaseClient,
  tenantId: string,
  input: FiStaffUpsertInput
): Promise<{ id: string }> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const fiUserId = input.fi_user_id?.trim() || null;
  if (fiUserId) await assertFiUserBelongsToTenant(supabase, tid, fiUserId);

  const wh =
    input.working_hours &&
    typeof input.working_hours === "object" &&
    !Array.isArray(input.working_hours)
      ? input.working_hours
      : {};
  const payload = {
    tenant_id: tid,
    full_name: input.full_name.trim(),
    staff_role: (input.staff_role ?? "consultant").trim() || "consultant",
    email: input.email?.trim() || null,
    mobile: input.mobile?.trim() || null,
    default_timezone: input.default_timezone?.trim() || null,
    working_hours: wh,
    is_active: input.is_active !== false,
    calendar_color: input.calendar_color?.trim() || null,
    fi_user_id: fiUserId,
  };

  const { data, error } = await supabase.from("fi_staff").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return { id: String((data as { id: string }).id) };
}

async function updateFiStaffRow(
  supabase: SupabaseClient,
  tenantId: string,
  staffId: string,
  patch: Partial<FiStaffUpsertInput>
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  await assertFiStaffBelongsToTenant(supabase, tid, sid);

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.full_name !== undefined)
    row.full_name = String(patch.full_name ?? "").trim() || "Staff";
  if (patch.staff_role !== undefined)
    row.staff_role = String(patch.staff_role ?? "consultant").trim() || "consultant";
  if (patch.email !== undefined) row.email = patch.email?.trim() || null;
  if (patch.mobile !== undefined) row.mobile = patch.mobile?.trim() || null;
  if (patch.default_timezone !== undefined)
    row.default_timezone = patch.default_timezone?.trim() || null;
  if (patch.working_hours !== undefined) {
    const wh =
      patch.working_hours &&
      typeof patch.working_hours === "object" &&
      !Array.isArray(patch.working_hours)
        ? patch.working_hours
        : {};
    row.working_hours = wh;
  }
  if (patch.is_active !== undefined) row.is_active = Boolean(patch.is_active);
  if (patch.calendar_color !== undefined) row.calendar_color = patch.calendar_color?.trim() || null;
  if (patch.fi_user_id !== undefined) {
    const fiUserId = patch.fi_user_id?.trim() || null;
    if (fiUserId) await assertFiUserBelongsToTenant(supabase, tid, fiUserId);
    row.fi_user_id = fiUserId;
  }

  const { error } = await supabase.from("fi_staff").update(row).eq("tenant_id", tid).eq("id", sid);
  if (error) throw new Error(error.message);
}

export async function loadSnapshotsForPlan(tenantId: string): Promise<{
  existingUsers: { id: string; email: string | null; role: string | null }[];
  existingStaff: {
    id: string;
    fi_user_id: string | null;
    full_name: string;
    staff_role: string;
    email: string | null;
    is_active: boolean;
    default_timezone: string | null;
    working_hours: Record<string, unknown>;
  }[];
  existingStaffSourceIds: {
    id: string;
    staff_id: string;
    source_system: string;
    source_staff_id: string;
    source_url: string | null;
    metadata: Record<string, unknown>;
  }[];
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = supabaseAdmin();
  const [usersRes, staffRes, srcRes] = await Promise.all([
    supabase.from("fi_users").select("id, email, role").eq("tenant_id", tid),
    supabase
      .from("fi_staff")
      .select(
        "id, fi_user_id, full_name, staff_role, email, mobile, is_active, default_timezone, working_hours"
      )
      .eq("tenant_id", tid),
    supabase
      .from("fi_staff_source_ids")
      .select("id, staff_id, source_system, source_staff_id, source_url, metadata")
      .eq("tenant_id", tid),
  ]);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (staffRes.error) throw new Error(staffRes.error.message);
  if (srcRes.error) throw new Error(srcRes.error.message);

  const existingUsers = (usersRes.data ?? []).map((r) => {
    const x = r as { id: string; email: string | null; role: string | null };
    return {
      id: String(x.id),
      email: x.email != null ? String(x.email) : null,
      role: x.role != null ? String(x.role) : null,
    };
  });
  const existingStaff = (staffRes.data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    const wh = x.working_hours;
    const working_hours =
      wh && typeof wh === "object" && !Array.isArray(wh) ? (wh as Record<string, unknown>) : {};
    return {
      id: String(x.id),
      fi_user_id: x.fi_user_id != null ? String(x.fi_user_id) : null,
      full_name: String(x.full_name ?? ""),
      staff_role: String(x.staff_role ?? "consultant"),
      email: x.email != null ? String(x.email) : null,
      mobile: x.mobile != null ? String(x.mobile) : null,
      is_active: Boolean(x.is_active),
      default_timezone: x.default_timezone != null ? String(x.default_timezone) : null,
      working_hours,
    };
  });
  const existingStaffSourceIds = (srcRes.data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    const md = x.metadata;
    const metadata =
      md && typeof md === "object" && !Array.isArray(md) ? (md as Record<string, unknown>) : {};
    return {
      id: String(x.id),
      staff_id: String(x.staff_id),
      source_system: String(x.source_system),
      source_staff_id: String(x.source_staff_id),
      source_url: x.source_url != null ? String(x.source_url) : null,
      metadata,
    };
  });

  return { existingUsers, existingStaff, existingStaffSourceIds };
}

/**
 * Applies a planned IIOHR HR staff import using the given Supabase client (tests inject a mock).
 */
export async function applyIiohrHrStaffImportPlanForTests(
  tenantId: string,
  plan: IiohrHrStaffImportPlanResult,
  applied: IiohrHrStaffImportCounts,
  supabase: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const rowIndexToNewFiUserId = new Map<number, string>();
  const rowIndexToNewFiStaffId = new Map<number, string>();

  const orderedActions = plan.perRow.flatMap((p) => p.actions);

  for (const action of orderedActions) {
    switch (action.type) {
      case "create_fi_user": {
        const { email, role } = action.payload;
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("fi_users")
          .insert({
            tenant_id: tid,
            email: email.trim(),
            role: role.trim() || "member",
            auth_user_id: null,
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();
        if (error) throw new Error(`create_fi_user: ${error.message}`);
        rowIndexToNewFiUserId.set(action.sourceRowIndex, String((data as { id: string }).id));
        applied.createdUsers += 1;
        break;
      }
      case "update_fi_user": {
        const { userId, email, role } = action.payload;
        const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (email !== undefined) row.email = email?.trim() || null;
        if (role !== undefined) row.role = role?.trim() || "member";
        const { error } = await supabase
          .from("fi_users")
          .update(row)
          .eq("id", userId.trim())
          .eq("tenant_id", tid);
        if (error) throw new Error(`update_fi_user: ${error.message}`);
        applied.updatedUsers += 1;
        break;
      }
      case "create_fi_staff": {
        const p = action.payload;
        let fiUserId = p.fi_user_id?.trim() || null;
        if (p.fi_user_id_from_same_row_index != null) {
          const mapped = rowIndexToNewFiUserId.get(p.fi_user_id_from_same_row_index);
          if (!mapped) {
            throw new Error(
              `create_fi_staff: missing fi_user id for row ${p.fi_user_id_from_same_row_index} (create_fi_user must run first).`
            );
          }
          fiUserId = mapped;
        }
        const created = await insertFiStaffRow(supabase, tid, {
          full_name: p.full_name,
          staff_role: p.staff_role,
          email: p.email,
          mobile: p.mobile,
          default_timezone: p.default_timezone,
          working_hours: p.working_hours,
          is_active: p.is_active,
          fi_user_id: fiUserId,
        });
        rowIndexToNewFiStaffId.set(action.sourceRowIndex, created.id);
        applied.createdStaff += 1;
        break;
      }
      case "update_fi_staff": {
        const { staffId, ...patch } = action.payload;
        await updateFiStaffRow(supabase, tid, staffId, patch);
        applied.updatedStaff += 1;
        break;
      }
      case "link_staff_to_user": {
        const { staffId, fiUserId } = action.payload;
        await updateFiStaffRow(supabase, tid, staffId, { fi_user_id: fiUserId });
        applied.linkedStaff += 1;
        break;
      }
      case "deactivate_staff": {
        await updateFiStaffRow(supabase, tid, action.payload.staffId, { is_active: false });
        applied.deactivatedStaff += 1;
        break;
      }
      case "create_staff_source_id": {
        const p = action.payload;
        const staffId =
          p.staffId?.trim() ||
          (p.staffFromRowIndex != null
            ? rowIndexToNewFiStaffId.get(p.staffFromRowIndex)
            : undefined);
        if (!staffId) {
          throw new Error(
            `create_staff_source_id: could not resolve staff_id (row ${action.sourceRowIndex}).`
          );
        }
        const now = new Date().toISOString();
        const { error } = await supabase.from("fi_staff_source_ids").insert({
          tenant_id: tid,
          staff_id: staffId,
          source_system: normalizeFiStaffSourceSystem(p.source_system),
          source_staff_id: normalizeFiStaffSourceStaffId(p.source_staff_id),
          source_url: p.source_url,
          metadata: normalizeFiStaffSourceMetadata(p.metadata),
          created_at: now,
          updated_at: now,
        });
        if (error) throw new Error(`create_staff_source_id: ${error.message}`);
        applied.createdSourceIds += 1;
        break;
      }
      case "update_staff_source_id": {
        const p = action.payload;
        const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (p.source_url !== undefined) row.source_url = p.source_url;
        if (p.metadata !== undefined) row.metadata = normalizeFiStaffSourceMetadata(p.metadata);
        const { error } = await supabase
          .from("fi_staff_source_ids")
          .update(row)
          .eq("id", p.id.trim())
          .eq("tenant_id", tid);
        if (error) throw new Error(`update_staff_source_id: ${error.message}`);
        applied.updatedSourceIds += 1;
        break;
      }
      case "skip_row":
        break;
      default:
        break;
    }
  }
}

export async function applyIiohrHrStaffImportPlan(
  tenantId: string,
  plan: IiohrHrStaffImportPlanResult,
  applied: IiohrHrStaffImportCounts
): Promise<void> {
  return applyIiohrHrStaffImportPlanForTests(tenantId, plan, applied, supabaseAdmin());
}

export type RunIiohrHrStaffImportParams = {
  tenantId: string;
  rows: unknown;
  /** When false (default), only plan + counts — no writes. */
  commit?: boolean;
  /** Required when `commit` is true (server / UI safety). */
  confirm?: boolean;
  adminKey?: string | null;
  /** Supabase Auth user id when not using admin API key (server actions with session). */
  authUserId?: string | null;
  /**
   * When true, skips `assertIiohrHrStaffImportAllowed` — caller must have enforced access
   * (e.g. `assertCrmTenantWriteAllowed` in HR staff import actions).
   */
  skipImportAuthCheck?: boolean;
  /**
   * Optional hook after Perth clinic metadata is attached (Stage 1 HR sync: stamp `last_synced_at`, etc.).
   * Mutations should edit `plan.perRow[*].actions` in place; `plan.actions` is rebuilt immediately after.
   */
  mutatePlanAfterAttachPerth?: (plan: IiohrHrStaffImportPlanResult) => void;
};

/**
 * Tenant-scoped IIOHR HR staff import: plan, optionally apply via service role.
 * Callers must pass `commit: true` and `confirm: true` to perform writes.
 */
export async function runIiohrHrStaffImport(
  params: RunIiohrHrStaffImportParams
): Promise<IiohrHrStaffImportRunResult> {
  const tenantParse = tenantIdSchema.safeParse(params.tenantId?.trim());
  if (!tenantParse.success) {
    return {
      ok: false,
      commit: params.commit === true,
      validationErrors: [tenantParse.error.errors[0]?.message ?? "Invalid tenantId."],
      warnings: [],
      skippedRowCount: 0,
      plan: emptyPlan(),
      dryRunCounts: emptyCounts(),
      error: "Validation failed.",
    };
  }
  const tenantId = tenantParse.data;

  if (!params.skipImportAuthCheck) {
    try {
      await assertIiohrHrStaffImportAllowed({
        tenantId,
        adminKey: params.adminKey,
        authUserId: params.authUserId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        commit: params.commit === true,
        validationErrors: [],
        warnings: [],
        skippedRowCount: 0,
        plan: emptyPlan(),
        dryRunCounts: emptyCounts(),
        error: msg,
      };
    }
  }

  const { rows, sourceRowIndices, validationErrors } = validateImportRows(params.rows);

  if (validationErrors.some((e) => e.includes("JSON array"))) {
    return {
      ok: false,
      commit: params.commit === true,
      validationErrors,
      warnings: [],
      skippedRowCount: 0,
      plan: emptyPlan(),
      dryRunCounts: emptyCounts(),
      error: "Validation failed.",
    };
  }

  const { existingUsers, existingStaff, existingStaffSourceIds } =
    await loadSnapshotsForPlan(tenantId);

  const plan =
    rows.length === 0
      ? emptyPlan()
      : planIiohrHrStaffImport({
          tenantId,
          rows,
          sourceRowIndices,
          existingUsers,
          existingStaff,
          existingStaffSourceIds,
        });

  if (rows.length > 0) {
    const { clinicId } = await resolveEvolvedHrPerthClinicForTenant(tenantId);
    attachEvolvedPerthClinicMetadataToPlan(plan, clinicId);
  }

  params.mutatePlanAfterAttachPerth?.(plan);
  if (rows.length > 0) {
    plan.actions = plan.perRow.flatMap((p) => p.actions);
  }

  const skippedRowCount = plan.perRow.filter(
    (p) => p.skippedDuplicate || p.skippedValidation
  ).length;
  const dryRunCounts = countFromActions(plan.actions);

  const commit = params.commit === true;
  if (!commit) {
    return {
      ok: true,
      commit: false,
      validationErrors,
      warnings: plan.warnings,
      skippedRowCount,
      plan,
      dryRunCounts,
      validatedPackedRows: rows,
    };
  }

  if (params.confirm !== true) {
    return {
      ok: false,
      commit: true,
      validationErrors,
      warnings: plan.warnings,
      skippedRowCount,
      plan,
      dryRunCounts,
      error: "commit requires confirm: true",
      validatedPackedRows: rows,
    };
  }

  if (rows.length === 0) {
    return {
      ok: false,
      commit: true,
      validationErrors,
      warnings: [],
      skippedRowCount: 0,
      plan: emptyPlan(),
      dryRunCounts: emptyCounts(),
      error: "Nothing to commit — no valid rows.",
      validatedPackedRows: rows,
    };
  }

  const applied = emptyCounts();
  try {
    await applyIiohrHrStaffImportPlan(tenantId, plan, applied);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      commit: true,
      validationErrors,
      warnings: plan.warnings,
      skippedRowCount,
      plan,
      dryRunCounts,
      appliedCounts: applied,
      error: msg,
      validatedPackedRows: rows,
    };
  }

  return {
    ok: true,
    commit: true,
    validationErrors,
    warnings: plan.warnings,
    skippedRowCount,
    plan,
    dryRunCounts,
    appliedCounts: applied,
    validatedPackedRows: rows,
  };
}

/** Console summary for CLI or debugging (does not run the import). */
export function logIiohrHrStaffImportReport(result: IiohrHrStaffImportRunResult): void {
  const counts = result.commit && result.appliedCounts ? result.appliedCounts : result.dryRunCounts;
  const countLabel = result.commit && result.appliedCounts ? "Applied" : "Planned";

  console.log(`\n=== IIOHR HR staff import (${result.commit ? "COMMIT" : "DRY-RUN"}) ===\n`);
  console.log(`OK: ${result.ok}${result.error ? ` — ${result.error}` : ""}`);

  if (result.validationErrors.length) {
    console.log("\nValidation errors:");
    for (const e of result.validationErrors) console.log(`  • ${e}`);
  }

  if (result.plan.validationIssues.length) {
    console.log("\nPlanner validation issues:");
    for (const v of result.plan.validationIssues) {
      console.log(`  • Row ${v.rowIndex}${v.field ? ` (${v.field})` : ""}: ${v.message}`);
    }
  }

  if (result.warnings.length) {
    console.log("\nPlanner warnings:");
    for (const w of result.warnings) console.log(`  • ${w}`);
  }

  console.log(`\nSkipped rows (duplicate match): ${result.skippedRowCount}`);

  console.log(`\n${countLabel} counts:`);
  console.log(`  Created fi_users:     ${counts.createdUsers}`);
  console.log(`  Updated fi_users:     ${counts.updatedUsers}`);
  console.log(`  Created fi_staff:     ${counts.createdStaff}`);
  console.log(`  Updated fi_staff:     ${counts.updatedStaff}`);
  console.log(`  Linked staff→user:    ${counts.linkedStaff}`);
  console.log(`  Deactivated staff:    ${counts.deactivatedStaff}`);
  console.log(`  Created source_ids:   ${counts.createdSourceIds}`);
  console.log(`  Updated source_ids:   ${counts.updatedSourceIds}`);

  if (result.commit && result.appliedCounts && !result.ok) {
    console.log(
      "\nNote: import aborted part-way; counts reflect actions completed before the error."
    );
  }

  console.log("");
}
