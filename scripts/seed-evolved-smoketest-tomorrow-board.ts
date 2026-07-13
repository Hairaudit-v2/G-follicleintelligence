#!/usr/bin/env tsx
/**
 * Idempotent seed: Evolved SMOKETEST tomorrow-board rows for T1 + DEF-READY-01 live bakes.
 *
 * Seeds two surgery bookings on tenant-local tomorrow (Australia/Perth):
 * - SMOKETEST-TMRW-UNAVAILABLE — no payment/invoice records → clearance unavailable copy
 * - SMOKETEST-TMRW-DEPOSIT-DUE — pending manual deposit → financial chip matrix
 *
 * Does not mutate the golden patient/case (287348d5 / 80ae7196).
 *
 * Usage:
 *   node scripts/run-with-system-ca.mjs tsx scripts/seed-evolved-smoketest-tomorrow-board.ts
 *   node scripts/run-with-system-ca.mjs tsx scripts/seed-evolved-smoketest-tomorrow-board.ts --commit
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { createBooking } from "../src/lib/bookings/bookings";
import { addDaysToCalendarDate, calendarDateStringFromInstant } from "../src/lib/calendar/calendarTimezone";
import { executeCrmLeadConversion } from "../src/lib/crm/leadConversion";
import { createCrmLeadWithPerson } from "../src/lib/crm/leads";
import { ensureDefaultPipelineStages } from "../src/lib/crm/pipeline";
import { createPaymentRecord } from "../src/lib/payments/paymentRecordMutations.server";

const EVOLVED_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const SMOKETEST_SEED_TAG = "SMOKETEST-TMRW-20260714";
const PERTH_TZ = "Australia/Perth";
function demoEmailForKey(key: string): string {
  const slug = key.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return `${slug}.${SMOKETEST_SEED_TAG}@evolved-smoketest.invalid`;
}

type TomorrowSeedSpec = {
  key: string;
  leadSummary: string;
  personDisplayName: string;
  bookingTitle: string;
  /** When true, create a pending manual deposit record linked to the booking. */
  withPendingDeposit: boolean;
  /** Stagger hour on tomorrow's Perth day (08:00 + offset). */
  hourOffset: number;
};

const TOMORROW_SPECS: TomorrowSeedSpec[] = [
  {
    key: "SMOKETEST-TMRW-UNAVAILABLE",
    leadSummary: `${SMOKETEST_SEED_TAG} SMOKETEST-TMRW-UNAVAILABLE lead`,
    personDisplayName: "SMOKETEST-TMRW Unavailable",
    bookingTitle: `${SMOKETEST_SEED_TAG} SMOKETEST-TMRW-UNAVAILABLE surgery`,
    withPendingDeposit: false,
    hourOffset: 0,
  },
  {
    key: "SMOKETEST-TMRW-DEPOSIT-DUE",
    leadSummary: `${SMOKETEST_SEED_TAG} SMOKETEST-TMRW-DEPOSIT-DUE lead`,
    personDisplayName: "SMOKETEST-TMRW Deposit due",
    bookingTitle: `${SMOKETEST_SEED_TAG} SMOKETEST-TMRW-DEPOSIT-DUE surgery`,
    withPendingDeposit: true,
    hourOffset: 2,
  },
];

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

const commit = process.argv.includes("--commit");

function perthTomorrowYmd(now = new Date()): string {
  const todayYmd = calendarDateStringFromInstant(now, PERTH_TZ);
  return addDaysToCalendarDate(todayYmd, 1, PERTH_TZ);
}

function perthBookingWindowForYmd(
  ymd: string,
  hourStart: number,
  durationHours = 2
): { start: string; end: string } {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const startUtc = new Date(Date.UTC(y, m - 1, d, hourStart - 8, 0, 0, 0));
  const endUtc = new Date(startUtc.getTime() + durationHours * 60 * 60 * 1000);
  return { start: startUtc.toISOString(), end: endUtc.toISOString() };
}

async function resolveActorFiUserId(tenantId: string): Promise<string> {
  const sb = supabaseAdmin();
  const { data: users, error } = await sb
    .from("fi_users")
    .select("id, auth_user_id")
    .eq("tenant_id", tenantId)
    .not("auth_user_id", "is", null)
    .limit(5);
  if (error) throw new Error(error.message);
  const linked = (users ?? []).find((u) => u.auth_user_id);
  if (!linked) throw new Error(`No linked fi_users for tenant ${tenantId}`);
  return String((linked as { id: string }).id);
}

async function findBookingByKey(
  tenantId: string,
  key: string
): Promise<{ id: string; caseId: string | null; patientId: string | null; leadId: string | null } | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("fi_bookings")
    .select("id, case_id, patient_id, lead_id")
    .eq("tenant_id", tenantId)
    .contains("metadata", { smoketest_key: key })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as
    | { id: string; case_id?: string | null; patient_id?: string | null; lead_id?: string | null }
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    caseId: row.case_id ? String(row.case_id) : null,
    patientId: row.patient_id ? String(row.patient_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
  };
}

async function findLeadByKey(
  tenantId: string,
  key: string
): Promise<{ leadId: string; patientId: string | null; caseId: string | null } | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("fi_crm_leads")
    .select("id, patient_id, case_id")
    .eq("tenant_id", tenantId)
    .contains("metadata", { smoketest_key: key })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as
    | { id: string; patient_id?: string | null; case_id?: string | null }
    | undefined;
  if (!row) return null;
  return {
    leadId: String(row.id),
    patientId: row.patient_id ? String(row.patient_id) : null,
    caseId: row.case_id ? String(row.case_id) : null,
  };
}

async function ensureLeadPatientCase(
  tenantId: string,
  spec: TomorrowSeedSpec,
  actorFiUserId: string,
  sb: SupabaseClient
): Promise<{ leadId: string; patientId: string; caseId: string; created: boolean }> {
  const existingBooking = await findBookingByKey(tenantId, spec.key);
  if (existingBooking?.caseId && existingBooking.patientId && existingBooking.leadId) {
    return {
      leadId: existingBooking.leadId,
      patientId: existingBooking.patientId,
      caseId: existingBooking.caseId,
      created: false,
    };
  }

  let existingLead = await findLeadByKey(tenantId, spec.key);
  if (existingLead?.patientId && existingLead.caseId) {
    return {
      leadId: existingLead.leadId,
      patientId: existingLead.patientId,
      caseId: existingLead.caseId,
      created: false,
    };
  }

  if (!commit) {
    console.log(`  [dry-run] would create lead/patient/case for ${spec.key}`);
    return {
      leadId: `dry-run-lead-${spec.key}`,
      patientId: `dry-run-patient-${spec.key}`,
      caseId: `dry-run-case-${spec.key}`,
      created: true,
    };
  }

  await ensureDefaultPipelineStages({ tenantId }, sb);

  if (existingLead && !existingLead.patientId) {
    const { error: delErr } = await sb
      .from("fi_crm_leads")
      .delete()
      .eq("tenant_id", tenantId)
      .contains("metadata", { smoketest_key: spec.key });
    if (delErr) throw new Error(delErr.message);
    existingLead = null;
  }

  const lead = await createCrmLeadWithPerson(
    {
      tenantId,
      summary: spec.leadSummary,
      metadata: {
        smoketest_key: spec.key,
        smoketest_seed_tag: SMOKETEST_SEED_TAG,
        smoketest_prefix: "SMOKETEST-",
      },
      person: {
        display_name: spec.personDisplayName,
        email: demoEmailForKey(spec.key),
      },
    },
    sb
  );

  const conv = await executeCrmLeadConversion(
    {
      tenantId,
      leadId: lead.id,
      seedCase: true,
      caseType: "hair_transplant",
      treatmentInterest: `${spec.key} FUE`,
      conversionNote: SMOKETEST_SEED_TAG,
      convertedByUserId: actorFiUserId,
    },
    sb
  );
  if (!conv.caseId) throw new Error(`Lead conversion did not seed case for ${spec.key}`);

  return {
    leadId: lead.id,
    patientId: conv.patientId,
    caseId: conv.caseId,
    created: true,
  };
}

async function ensureTomorrowBooking(
  tenantId: string,
  spec: TomorrowSeedSpec,
  ctx: { leadId: string; patientId: string; caseId: string },
  tomorrowYmd: string,
  actorFiUserId: string
): Promise<{ bookingId: string; created: boolean }> {
  const existing = await findBookingByKey(tenantId, spec.key);
  if (existing) return { bookingId: existing.id, created: false };

  const window = perthBookingWindowForYmd(tomorrowYmd, 8 + spec.hourOffset, 2);

  if (!commit) {
    console.log(
      `  [dry-run] would create booking ${spec.key} on ${tomorrowYmd} ${window.start} → ${window.end}`
    );
    return { bookingId: `dry-run-booking-${spec.key}`, created: true };
  }

  const sb = supabaseAdmin();
  const booking = await createBooking(
    {
      tenantId,
      patientId: ctx.patientId,
      caseId: ctx.caseId,
      leadId: ctx.leadId,
      bookingType: "surgery",
      title: spec.bookingTitle,
      startAt: window.start,
      endAt: window.end,
      timezone: PERTH_TZ,
      roomRequired: false,
      metadata: {
        smoketest_key: spec.key,
        smoketest_seed_tag: SMOKETEST_SEED_TAG,
        smoketest_prefix: "SMOKETEST-",
      },
      createdByUserId: actorFiUserId,
    },
    sb
  );

  return { bookingId: booking.id, created: true };
}

async function ensurePendingDeposit(
  tenantId: string,
  spec: TomorrowSeedSpec,
  ctx: { leadId: string; patientId: string; caseId: string; bookingId: string },
  actorFiUserId: string
): Promise<{ paymentRecordId: string | null; created: boolean }> {
  if (!spec.withPendingDeposit) return { paymentRecordId: null, created: false };

  if (!commit || ctx.bookingId.startsWith("dry-run-")) {
    console.log(`  [dry-run] would create pending deposit for ${spec.key}`);
    return { paymentRecordId: `dry-run-deposit-${spec.key}`, created: true };
  }

  const sb = supabaseAdmin();
  const { data: existing, error: findErr } = await sb
    .from("fi_payment_records")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("booking_id", ctx.bookingId)
    .eq("payment_context", "surgery")
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (existing) {
    return { paymentRecordId: String((existing as { id: string }).id), created: false };
  }

  const payment = await createPaymentRecord(
    tenantId,
    {
      payment_context: "surgery",
      patient_id: ctx.patientId,
      lead_id: ctx.leadId,
      case_id: ctx.caseId,
      booking_id: ctx.bookingId,
      amount_expected: 500,
      amount_paid: 0,
      currency: "AUD",
      status: "pending",
      notes: `${SMOKETEST_SEED_TAG} ${spec.key} pending deposit`,
    },
    actorFiUserId
  );

  return { paymentRecordId: payment.id, created: true };
}

async function main(): Promise<void> {
  const tomorrowYmd = perthTomorrowYmd();
  console.log(`Evolved SMOKETEST tomorrow-board seed (${commit ? "COMMIT" : "dry-run"})`);
  console.log(`Tenant: ${EVOLVED_TENANT_ID}`);
  console.log(`Tomorrow (Perth): ${tomorrowYmd}\n`);

  const actorFiUserId = await resolveActorFiUserId(EVOLVED_TENANT_ID);
  const sb = supabaseAdmin();

  const results: {
    key: string;
    leadId: string;
    patientId: string;
    caseId: string;
    bookingId: string;
    paymentRecordId: string | null;
    withPendingDeposit: boolean;
    created: boolean;
  }[] = [];

  for (const spec of TOMORROW_SPECS) {
    console.log(`Processing ${spec.key}…`);
    const lpc = await ensureLeadPatientCase(EVOLVED_TENANT_ID, spec, actorFiUserId, sb);
    const booking = await ensureTomorrowBooking(
      EVOLVED_TENANT_ID,
      spec,
      lpc,
      tomorrowYmd,
      actorFiUserId
    );
    const deposit = await ensurePendingDeposit(
      EVOLVED_TENANT_ID,
      spec,
      { ...lpc, bookingId: booking.bookingId },
      actorFiUserId
    );
    const created = lpc.created || booking.created || deposit.created;
    results.push({
      key: spec.key,
      leadId: lpc.leadId,
      patientId: lpc.patientId,
      caseId: lpc.caseId,
      bookingId: booking.bookingId,
      paymentRecordId: deposit.paymentRecordId,
      withPendingDeposit: spec.withPendingDeposit,
      created,
    });
    console.log(
      `  lead=${lpc.leadId} case=${lpc.caseId} booking=${booking.bookingId} deposit=${deposit.paymentRecordId ?? "none"} ${created ? "CREATED/updated" : "existing"}`
    );
  }

  console.log("\nSummary:");
  console.log(
    JSON.stringify({ mode: commit ? "commit" : "dry-run", tomorrowYmd, results }, null, 2)
  );

  if (!commit) {
    console.log("\nRe-run with --commit to apply.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
