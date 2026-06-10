import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  CLINIC_SETUP_WIZARD_SOURCE,
  buildPlannedRoomsFromCounts,
  buildServiceRoomPlans,
  type ApplyClinicSetupResult,
  type ClinicSetupRoomCounts,
  type ClinicSetupStaffInput,
  type ClinicSetupWizardPreviewPayload,
} from "@/src/lib/clinicSetup/clinicSetupWizardCore";
import {
  insertClinicRoom,
  loadClinicRoomsForTenant,
  loadServiceEligibilityMapsForTenant,
  updateClinicRoom,
} from "@/src/lib/rooms/fiClinicRooms.server";
import { filterRoomEligibilityForClinic } from "@/src/lib/rooms/roomAvailability.server";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import { isNonCalendarSupportRole } from "@/src/lib/staff/calendarVisibleStaff";
import { loadFiServicesForTenant } from "@/src/lib/services/fiServices.server";

export {
  CLINIC_SETUP_WIZARD_SOURCE,
  buildDefaultEvolvedPerthCounts,
  buildPlannedRoomsFromCounts,
  buildServiceRoomPlans,
  categorizeServiceForWizard,
  type ClinicSetupRoomCounts,
  type ClinicSetupStaffInput,
  type ClinicSetupServicePlanPreview,
  type ClinicSetupWizardPreviewPayload,
  type PlannedClinicRoomRow,
  type ServiceRoomPlanRow,
  type WizardServiceCategory,
} from "@/src/lib/clinicSetup/clinicSetupWizardCore";

function isManualRoom(room: FiClinicRoomRow): boolean {
  const m = room.metadata;
  return Boolean(
    m && typeof m === "object" && !Array.isArray(m) && (m as { manual_room_override?: boolean }).manual_room_override
  );
}

export async function loadClinicSetupWizardBootstrap(args: {
  tenantId: string;
  clinicId: string;
  client?: SupabaseClient;
}): Promise<{
  services: Awaited<ReturnType<typeof loadFiServicesForTenant>>;
  rooms: FiClinicRoomRow[];
  staff: Array<{
    id: string;
    full_name: string;
    staff_role: string | null;
    calendar_visible: boolean | null;
  }>;
  eligibilityMaps: Awaited<ReturnType<typeof loadServiceEligibilityMapsForTenant>>;
  clinicSettingsMetadata: Record<string, unknown>;
}> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(args.clinicId, "clinicId");
  const supabase = args.client ?? supabaseAdmin();

  const [services, rooms, eligibilityMaps, staffRes, settingsRes] = await Promise.all([
    loadFiServicesForTenant(tid),
    loadClinicRoomsForTenant(tid, { clinicId: cid }, supabase),
    loadServiceEligibilityMapsForTenant(tid, supabase),
    supabase
      .from("fi_staff")
      .select("id, full_name, staff_role, is_active, calendar_visible")
      .eq("tenant_id", tid)
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("fi_clinic_settings").select("metadata").eq("tenant_id", tid).eq("clinic_id", cid).maybeSingle(),
  ]);

  if (staffRes.error) throw new Error(staffRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);

  const metaRaw = settingsRes.data?.metadata;
  const clinicSettingsMetadata =
    metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw) ? (metaRaw as Record<string, unknown>) : {};

  const staff = (staffRes.data ?? []).map((raw) => {
    const r = raw as {
      id: string;
      full_name: string;
      staff_role: string | null;
      is_active: boolean;
      calendar_visible: boolean | null;
    };
    return {
      id: String(r.id),
      full_name: String(r.full_name ?? "").trim() || "Staff",
      staff_role: r.staff_role != null ? String(r.staff_role) : null,
      calendar_visible: r.calendar_visible == null ? null : Boolean(r.calendar_visible),
    };
  });

  return { services, rooms, staff, eligibilityMaps, clinicSettingsMetadata };
}

function staffMatchesServiceCategory(
  staff: ClinicSetupStaffInput,
  cat: "consult" | "regenerative" | "surgery"
): boolean {
  if (cat === "consult") return staff.performsConsultations;
  if (cat === "regenerative") return staff.performsPrp;
  if (cat === "surgery") return staff.performsSurgery || staff.assistsSurgery;
  return false;
}

function resolveCalendarVisibleValue(staffRole: string | null, showOnCalendar: boolean): boolean | null {
  if (showOnCalendar) return true;
  if (isNonCalendarSupportRole(staffRole)) return false;
  return null;
}

async function deleteWizardStaffEligibilityForServices(
  supabase: SupabaseClient,
  tenantId: string,
  serviceIds: string[]
): Promise<void> {
  if (serviceIds.length === 0) return;
  const { data, error } = await supabase
    .from("fi_service_staff_eligibility")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .in("service_id", serviceIds);
  if (error) throw new Error(error.message);
  const ids = (data ?? [])
    .filter((raw) => {
      const m = (raw as { metadata?: unknown }).metadata;
      if (!m || typeof m !== "object" || Array.isArray(m)) return false;
      return String((m as { source?: string }).source ?? "") === CLINIC_SETUP_WIZARD_SOURCE;
    })
    .map((raw) => String((raw as { id: string }).id));
  if (ids.length === 0) return;
  const { error: delErr } = await supabase.from("fi_service_staff_eligibility").delete().in("id", ids);
  if (delErr) throw new Error(delErr.message);
}

async function deleteWizardRoomEligibilityForServices(
  supabase: SupabaseClient,
  tenantId: string,
  serviceIds: string[]
): Promise<void> {
  if (serviceIds.length === 0) return;
  const { data, error } = await supabase
    .from("fi_service_room_eligibility")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .in("service_id", serviceIds);
  if (error) throw new Error(error.message);
  const ids = (data ?? [])
    .filter((raw) => {
      const m = (raw as { metadata?: unknown }).metadata;
      if (!m || typeof m !== "object" || Array.isArray(m)) return false;
      return String((m as { source?: string }).source ?? "") === CLINIC_SETUP_WIZARD_SOURCE;
    })
    .map((raw) => String((raw as { id: string }).id));
  if (ids.length === 0) return;
  const { error: delErr } = await supabase.from("fi_service_room_eligibility").delete().in("id", ids);
  if (delErr) throw new Error(delErr.message);
}

export async function applyClinicSetupWizard(args: {
  tenantId: string;
  clinicId: string;
  counts: ClinicSetupRoomCounts;
  useStandardSecondRoomAliases: boolean;
  staff: ClinicSetupStaffInput[];
  dryRun: boolean;
  client?: SupabaseClient;
}): Promise<ApplyClinicSetupResult> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(args.clinicId, "clinicId");
  const supabase = args.client ?? supabaseAdmin();
  const warnings: string[] = [];

  const planned = buildPlannedRoomsFromCounts({
    clinicId: cid,
    counts: args.counts,
    useStandardSecondRoomAliases: args.useStandardSecondRoomAliases,
  });

  const { services, rooms: existingBefore } = await loadClinicSetupWizardBootstrap({
    tenantId: tid,
    clinicId: cid,
    client: supabase,
  });

  const existingByCode = new Map(existingBefore.map((r) => [r.room_code.trim(), r]));
  let roomsCreated = 0;
  let roomsUpdated = 0;
  let roomsSkippedManual = 0;

  if (!args.dryRun) {
    for (const pr of planned) {
      const ex = existingByCode.get(pr.room_code);
      const meta = { source: CLINIC_SETUP_WIZARD_SOURCE };
      if (!ex) {
        await insertClinicRoom(
          tid,
          {
            clinicId: cid,
            roomCode: pr.room_code,
            displayName: pr.display_name,
            physicalRoomKey: pr.physical_room_key,
            roomType: pr.room_type,
            capabilities: pr.capabilities,
            isActive: true,
            sortOrder: pr.sort_order,
            metadata: meta,
          },
          supabase
        );
        roomsCreated += 1;
      } else if (isManualRoom(ex)) {
        roomsSkippedManual += 1;
        warnings.push(`Skipped updating room ${pr.room_code} (marked manual override).`);
      } else {
        const exMeta = ex.metadata && typeof ex.metadata === "object" && !Array.isArray(ex.metadata) ? ex.metadata : {};
        const src = String((exMeta as { source?: string }).source ?? "");
        const keys = Object.keys(exMeta);
        if (keys.length > 0 && src !== CLINIC_SETUP_WIZARD_SOURCE) {
          roomsSkippedManual += 1;
          warnings.push(`Skipped updating room ${pr.room_code} (non-wizard metadata preserved).`);
          continue;
        }
        const mergedMeta = { ...exMeta, ...meta };

        await updateClinicRoom(
          tid,
          ex.id,
          {
            displayName: pr.display_name,
            physicalRoomKey: pr.physical_room_key,
            roomType: pr.room_type,
            capabilities: pr.capabilities,
            sortOrder: pr.sort_order,
            isActive: true,
            metadata: mergedMeta,
          },
          supabase
        );
        roomsUpdated += 1;
      }
    }
  }

  const roomsAfter = args.dryRun ? existingBefore : await loadClinicRoomsForTenant(tid, { clinicId: cid }, supabase);
  const roomIdByCode = new Map(roomsAfter.map((r) => [r.room_code.trim(), r.id]));

  const plans = buildServiceRoomPlans({ services, plannedRooms: planned });
  const managedServiceIds = new Set(plans.map((p) => p.serviceId));

  for (const p of plans) {
    const missing = p.roomCodes.filter((code) => !roomIdByCode.has(code));
    if (missing.length) {
      warnings.push(`Service “${p.serviceName}”: missing rooms ${missing.join(", ")} — skipped room mapping.`);
    }
  }

  let roomEligibilityUpserts = 0;
  let staffEligibilityRows = 0;

  if (!args.dryRun && managedServiceIds.size > 0) {
    const sidList = Array.from(managedServiceIds);
    await deleteWizardRoomEligibilityForServices(supabase, tid, sidList);
    await deleteWizardStaffEligibilityForServices(supabase, tid, sidList);

    const now = new Date().toISOString();
    for (const p of plans) {
      const resolvedIds = p.roomCodes.map((c) => roomIdByCode.get(c)).filter((x): x is string => Boolean(x));
      if (resolvedIds.length === 0) continue;

      for (const roomId of resolvedIds) {
        const prefCode = p.preferredRoomCode?.trim() ?? "";
        const preferred = prefCode && roomIdByCode.get(prefCode) === roomId;
        const { error } = await supabase.from("fi_service_room_eligibility").upsert(
          {
            tenant_id: tid,
            clinic_id: cid,
            service_id: p.serviceId,
            room_id: roomId,
            is_preferred: preferred,
            is_active: true,
            metadata: { source: CLINIC_SETUP_WIZARD_SOURCE },
            updated_at: now,
          },
          { onConflict: "tenant_id,service_id,room_id" }
        );
        if (error) throw new Error(error.message);
        roomEligibilityUpserts += 1;
      }

      const cat =
        p.category === "consult_strict" || p.category === "consult_loose"
          ? ("consult" as const)
          : p.category === "regenerative"
            ? ("regenerative" as const)
            : p.category === "surgery"
              ? ("surgery" as const)
              : null;

      if (!cat || p.category === "block") {
        continue;
      }

      for (const st of args.staff) {
        if (!staffMatchesServiceCategory(st, cat)) continue;
        const { error: insErr } = await supabase.from("fi_service_staff_eligibility").insert({
          tenant_id: tid,
          service_id: p.serviceId,
          staff_id: st.staffId.trim(),
          staff_role: null,
          is_required: false,
          is_active: true,
          metadata: { source: CLINIC_SETUP_WIZARD_SOURCE },
          created_at: now,
          updated_at: now,
        });
        if (insErr) throw new Error(insErr.message);
        staffEligibilityRows += 1;
      }
    }
  }

  let staffCalendarUpdates = 0;
  if (!args.dryRun && args.staff.length > 0) {
    const roleRes = await supabase
      .from("fi_staff")
      .select("id, staff_role")
      .eq("tenant_id", tid)
      .eq("is_active", true);
    if (roleRes.error) throw new Error(roleRes.error.message);
    const roleLookup = new Map(
      (roleRes.data ?? []).map((r) => [
        String((r as { id: string }).id),
        String((r as { staff_role?: string | null }).staff_role ?? ""),
      ])
    );

    for (const st of args.staff) {
      const roleRaw = roleLookup.get(st.staffId.trim()) ?? null;
      const nextVis = resolveCalendarVisibleValue(roleRaw, st.showOnCalendar);
      const { error } = await supabase
        .from("fi_staff")
        .update({ calendar_visible: nextVis, updated_at: new Date().toISOString() })
        .eq("tenant_id", tid)
        .eq("id", st.staffId.trim());
      if (error) throw new Error(error.message);
      staffCalendarUpdates += 1;
    }
  }

  if (!args.dryRun) {
    const { data: row, error: selErr } = await supabase
      .from("fi_clinic_settings")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .eq("clinic_id", cid)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    const prevMeta =
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const nextMeta = {
      ...prevMeta,
      clinic_setup_wizard: {
        completed_at: new Date().toISOString(),
        source: CLINIC_SETUP_WIZARD_SOURCE,
      },
    };
    const upsertBody = {
      tenant_id: tid,
      clinic_id: cid,
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase.from("fi_clinic_settings").upsert(upsertBody, {
      onConflict: "tenant_id,clinic_id",
    });
    if (upErr) throw new Error(upErr.message);
  }

  return {
    roomsCreated,
    roomsUpdated,
    roomsSkippedManual,
    roomEligibilityUpserts,
    staffEligibilityRows,
    staffCalendarUpdates,
    warnings,
  };
}

export async function buildClinicSetupWizardPreview(args: {
  tenantId: string;
  clinicId: string;
  counts: ClinicSetupRoomCounts;
  useStandardSecondRoomAliases: boolean;
}): Promise<ClinicSetupWizardPreviewPayload> {
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(args.clinicId, "clinicId");
  const { services, eligibilityMaps, clinicSettingsMetadata } = await loadClinicSetupWizardBootstrap({
    tenantId: tid,
    clinicId: cid,
  });

  const planned = buildPlannedRoomsFromCounts({
    clinicId: cid,
    counts: args.counts,
    useStandardSecondRoomAliases: args.useStandardSecondRoomAliases,
  });
  const plans = buildServiceRoomPlans({ services, plannedRooms: planned });
  const roomByServiceId = eligibilityMaps.roomByServiceId;

  const servicePlans = plans.map((p) => {
    const rows = (roomByServiceId.get(p.serviceId) ?? []).filter((r) => r.is_active);
    const forClinic = filterRoomEligibilityForClinic(rows, cid);
    const nonWizard = forClinic.filter((r) => {
      const m = r.metadata;
      const src =
        m && typeof m === "object" && !Array.isArray(m) ? String((m as { source?: string }).source ?? "") : "";
      return src.length > 0 && src !== CLINIC_SETUP_WIZARD_SOURCE;
    });
    return {
      ...p,
      existingActiveRoomLinks: forClinic.length,
      hasNonWizardRoomLinks: nonWizard.length > 0,
      alreadyConfigured: forClinic.length > 0,
    };
  });

  const wizardMeta = clinicSettingsMetadata.clinic_setup_wizard as { completed_at?: string } | undefined;
  const completedAt =
    wizardMeta?.completed_at && String(wizardMeta.completed_at).trim() ? String(wizardMeta.completed_at) : null;

  const warnings: string[] = [];
  const c = args.counts;
  if (
    args.useStandardSecondRoomAliases &&
    (c.consult < 2 || c.patient < 2 || c.prp < 2 || c.surgery < 2)
  ) {
    warnings.push(
      "Standard second-room physical pairing is only applied when you have at least two consult, patient, PRP, and surgery rooms."
    );
  }

  return { plannedRooms: planned, servicePlans, warnings, completedAt };
}
