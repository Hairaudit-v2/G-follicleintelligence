#!/usr/bin/env tsx
/**
 * Idempotent seed: Evolved Perth service → room + staff eligibility mappings.
 *
 * Usage:
 *   npm run seed -- --dry-run
 *   npm run seed
 *   npm run seed -- --tenant=evolved-hair --clinic="Evolved Hair Restoration Perth"
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  buildEvolvedPerthServiceEligibilitySeedPlan,
  clinicMatchesQuery,
  DEFAULT_CLINIC_LOOKUPS,
  DEFAULT_TENANT_LOOKUPS,
  tenantMatchesQuery,
  type PlannedServiceEligibility,
  type SeedRoomRow,
  type SeedServiceRow,
} from "../src/lib/rooms/evolvedPerthServiceEligibilitySeedPlan";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

function readArg(name: string): string | null {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3).trim() || null;
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1]!.startsWith("--")) {
    return process.argv[idx + 1]!.trim();
  }
  return null;
}

const dryRun = process.argv.includes("--dry-run");
const tenantOverride = readArg("tenant");
const clinicOverride = readArg("clinic");

type TenantRow = { id: string; slug: string; name: string };
type ClinicRow = { id: string; display_name: string; metadata: Record<string, unknown> | null };

async function resolveTenant(supabase: ReturnType<typeof supabaseAdmin>): Promise<TenantRow> {
  const lookups = tenantOverride ? [tenantOverride] : [...DEFAULT_TENANT_LOOKUPS];
  const { data, error } = await supabase.from("fi_tenants").select("id, slug, name");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TenantRow[];
  for (const q of lookups) {
    const hit = rows.find((r) => tenantMatchesQuery(r, q));
    if (hit) return hit;
  }
  throw new Error(
    `Tenant not found for ${lookups.map((q) => `“${q}”`).join(", ")}. Pass --tenant= or create the Evolved tenant first.`
  );
}

async function resolveClinic(
  supabase: ReturnType<typeof supabaseAdmin>,
  tenantId: string
): Promise<ClinicRow> {
  const lookups = clinicOverride ? [clinicOverride] : [...DEFAULT_CLINIC_LOOKUPS];
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => {
    const raw = r as { id: string; display_name: string; metadata: unknown };
    const meta =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), display_name: String(raw.display_name), metadata: meta };
  });

  for (const q of lookups) {
    const hit = rows.find((r) => clinicMatchesQuery(r, q));
    if (hit) return hit;
  }

  const lower = (s: string) => s.trim().toLowerCase();
  const evolvedPerth = rows.find((r) => {
    const d = lower(r.display_name);
    return d.includes("perth") && (d.includes("evolved") || d.includes("restoration") || d.includes("hair"));
  });
  if (evolvedPerth) return evolvedPerth;

  throw new Error(
    `Clinic not found for ${lookups.map((q) => `“${q}”`).join(", ")}. Pass --clinic= or add Evolved Hair Restoration Perth.`
  );
}

function printPlanTable(planned: PlannedServiceEligibility[]): void {
  console.log("\nPlanned mappings:\n");
  for (const row of planned) {
    console.log(`• ${row.service.name} (${row.service.booking_type ?? "no type"})`);
    console.log(`  Profile: ${row.profileLabel}`);
    if (row.skipRoomEligibility) {
      console.log(`  Rooms: (skipped — non-room service)`);
      if (row.warning) console.log(`  Warning: ${row.warning}`);
    } else {
      console.log(`  Rooms: ${row.roomCodes.join(", ") || "(none)"}`);
      console.log(`  Preferred: ${row.preferredRoomCode ?? "(none)"}`);
      if (row.missingRoomCodes.length) console.log(`  Missing rooms: ${row.missingRoomCodes.join(", ")}`);
    }
    console.log(`  Staff roles: ${row.staffRoles.join(", ") || "(none)"}`);
  }
}

async function applyPlan(args: {
  tenantId: string;
  clinicId: string;
  planned: PlannedServiceEligibility[];
}): Promise<{ roomRowsWritten: number; staffRowsWritten: number; servicesCleared: number }> {
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();
  let roomRowsWritten = 0;
  let staffRowsWritten = 0;
  let servicesCleared = 0;

  for (const row of args.planned) {
    const sid = row.service.id;

    await supabase.from("fi_service_room_eligibility").delete().eq("tenant_id", args.tenantId).eq("service_id", sid);
    await supabase.from("fi_service_staff_eligibility").delete().eq("tenant_id", args.tenantId).eq("service_id", sid);
    servicesCleared += 1;

    if (row.skipRoomEligibility) continue;

    for (const roomId of row.resolvedRoomIds) {
      const { error } = await supabase.from("fi_service_room_eligibility").upsert(
        {
          tenant_id: args.tenantId,
          clinic_id: args.clinicId,
          service_id: sid,
          room_id: roomId,
          is_preferred: row.preferredRoomId === roomId,
          is_active: true,
          metadata: { seed: "evolved_perth_service_room_eligibility" },
          updated_at: now,
        },
        { onConflict: "tenant_id,service_id,room_id" }
      );
      if (error) throw new Error(`Room eligibility upsert failed for ${row.service.name}: ${error.message}`);
      roomRowsWritten += 1;
    }

    for (const staffRole of row.staffRoles) {
      const { error } = await supabase.from("fi_service_staff_eligibility").insert({
        tenant_id: args.tenantId,
        service_id: sid,
        staff_id: null,
        staff_role: staffRole,
        is_required: false,
        is_active: true,
        metadata: { seed: "evolved_perth_service_room_eligibility" },
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(`Staff eligibility insert failed for ${row.service.name}: ${error.message}`);
      staffRowsWritten += 1;
    }
  }

  return { roomRowsWritten, staffRowsWritten, servicesCleared };
}

async function main(): Promise<void> {
  const supabase = supabaseAdmin();
  const tenant = await resolveTenant(supabase);
  const clinic = await resolveClinic(supabase, tenant.id);

  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Clinic: ${clinic.display_name}`);
  console.log(dryRun ? "Mode: DRY RUN (no writes)" : "Mode: COMMIT");

  const [servicesRes, roomsRes] = await Promise.all([
    supabase
      .from("fi_services")
      .select("id, name, booking_type, category, is_active")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("fi_clinic_rooms")
      .select("id, room_code, display_name, is_active")
      .eq("tenant_id", tenant.id)
      .eq("clinic_id", clinic.id)
      .order("sort_order"),
  ]);

  if (servicesRes.error) throw new Error(servicesRes.error.message);
  if (roomsRes.error) throw new Error(roomsRes.error.message);

  const services = (servicesRes.data ?? []) as SeedServiceRow[];
  const rooms = (roomsRes.data ?? []) as SeedRoomRow[];

  if (!rooms.length) {
    console.warn("\nWarning: No fi_clinic_rooms rows for this clinic. Run room migrations / Perth room seed first.\n");
  }

  const plan = buildEvolvedPerthServiceEligibilitySeedPlan(services, rooms);
  printPlanTable(plan.planned);

  if (plan.skipped.length) {
    console.log("\nSkipped services:");
    for (const s of plan.skipped) {
      console.log(`  • ${s.service.name}: ${s.reason}`);
    }
  }

  if (plan.warnings.length) {
    console.log("\nWarnings:");
    for (const w of plan.warnings) console.log(`  • ${w}`);
  }

  if (plan.missingRoomCodes.length) {
    console.log(`\nMissing room codes (not in fi_clinic_rooms): ${plan.missingRoomCodes.join(", ")}`);
  }

  console.log("\nSummary:");
  console.log(`  Active services loaded: ${services.length}`);
  console.log(`  Services matched: ${plan.planned.length}`);
  console.log(`  Services skipped: ${plan.skipped.length}`);
  console.log(`  Active rooms at clinic: ${rooms.filter((r) => r.is_active).length}`);

  if (dryRun) {
    const wouldWriteRooms = plan.planned.reduce((n, p) => n + p.resolvedRoomIds.length, 0);
    const wouldWriteStaff = plan.planned.reduce((n, p) => n + (p.skipRoomEligibility ? 0 : p.staffRoles.length), 0);
    console.log(`  Would write room eligibility rows: ${wouldWriteRooms}`);
    console.log(`  Would write staff eligibility rows: ${wouldWriteStaff}`);
    console.log("\nDry run complete — no database changes made.");
    return;
  }

  const result = await applyPlan({ tenantId: tenant.id, clinicId: clinic.id, planned: plan.planned });
  console.log(`  Room eligibility rows upserted: ${result.roomRowsWritten}`);
  console.log(`  Staff eligibility rows inserted: ${result.staffRowsWritten}`);
  console.log(`  Services refreshed (delete + rewrite): ${result.servicesCleared}`);
  console.log("\nSeed complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
