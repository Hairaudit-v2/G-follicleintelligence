#!/usr/bin/env tsx
/**
 * Execute Evolved 12-step SMOKETEST journey via service-role mutations.
 * Prefix: SMOKETEST-JOURNEY-001-20260630
 *
 * Usage:
 *   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/run-evolved-smoketest-journey.ts
 *   ... --commit
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { upsertPostOpTrackingForCase } from "../src/lib/cases/postOpUpdate";
import { upsertProcedureDayForCase } from "../src/lib/cases/procedureDayUpdate";
import { upsertSurgeryPlanForCase } from "../src/lib/cases/surgeryPlanningUpdate";
import { createBooking } from "../src/lib/bookings/bookings";
import {
  completeConsultationDraft,
  createConsultationFromBooking,
} from "../src/lib/consultations/consultationMutations.server";
import { appendCrmActivityEvent } from "../src/lib/crm/activity";
import { executeCrmLeadConversion } from "../src/lib/crm/leadConversion";
import { createCrmLeadWithPerson } from "../src/lib/crm/leads";
import { createCrmNoteForLead } from "../src/lib/crm/notes";
import { ensureDefaultPipelineStages, loadPipelineStages } from "../src/lib/crm/pipeline";
import { moveCrmLeadToStage } from "../src/lib/crm/stageMovement";
import { createCrmTask } from "../src/lib/crm/tasks";
import { createPaymentRecord } from "../src/lib/payments/paymentRecordMutations.server";

const JOURNEY_TAG = "SMOKETEST-JOURNEY-001-20260630";
const DEMO_EMAIL = "tester+smoketest@follicleintelligence.ai";
const DEMO_PHONE = "0000000000";

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

function perthIso(daysFromNow: number, hour = 10): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour - 8, 0, 0, 0);
  return d.toISOString();
}

type StepResult = { step: number; name: string; pass: boolean; ids: Record<string, string>; error?: string };

async function resolveTenantAndActor(): Promise<{ tenantId: string; actorFiUserId: string }> {
  const tenantId =
    process.env.EVOLVED_PERTH_TENANT_ID?.trim() ??
    (() => {
      throw new Error("EVOLVED_PERTH_TENANT_ID missing");
    })();
  const sb = supabaseAdmin();
  const { data: users, error } = await sb
    .from("fi_users")
    .select("id, auth_user_id, role")
    .eq("tenant_id", tenantId)
    .not("auth_user_id", "is", null)
    .limit(5);
  if (error) throw error;
  const linked = (users ?? []).find((u) => u.auth_user_id);
  if (!linked) throw new Error("No linked fi_users for tenant");
  return { tenantId, actorFiUserId: String((linked as { id: string }).id) };
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const commit = process.argv.includes("--execute");
  const { tenantId, actorFiUserId } = await resolveTenantAndActor();
  const sb = supabaseAdmin();
  const results: StepResult[] = [];
  const manifest: Record<string, string> = {
    journeyId: JOURNEY_TAG,
    tenantId,
    actorFiUserId,
  };

  console.log(`Evolved smoketest journey ${commit ? "COMMIT" : "DRY-RUN"}`);
  console.log(`Tenant: ${tenantId}`);
  console.log("---");

  if (!commit) {
    console.log("DRY-RUN: would execute 12 steps with SMOKETEST- prefixed records.");
    console.log("Re-run with --execute");
    return;
  }

  const runStep = async (
    step: number,
    name: string,
    fn: () => Promise<Record<string, string>>
  ): Promise<void> => {
    try {
      const ids = await fn();
      Object.assign(manifest, ids);
      results.push({ step, name, pass: true, ids });
      console.log(`PASS step ${step}: ${name}`);
      for (const [k, v] of Object.entries(ids)) console.log(`  ${k}=${v}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ step, name, pass: false, ids: {}, error: msg });
      console.error(`FAIL step ${step}: ${name} — ${msg}`);
      throw e;
    }
  };

  await runStep(1, "Lead Created", async () => {
    await ensureDefaultPipelineStages({ tenantId }, sb);
    const stages = await loadPipelineStages({ tenantId }, sb);
    const entry = stages.find((s) => s.is_entry) ?? stages[0];
    const second = stages.find((s) => s.id !== entry.id) ?? entry;

    const lead = await createCrmLeadWithPerson(
      {
        tenantId,
        summary: `${JOURNEY_TAG} SMOKETEST-LEAD-001`,
        metadata: { smoketest: JOURNEY_TAG },
        person: {
          first_name: "SMOKETEST-Patient",
          last_name: "001",
          email: DEMO_EMAIL,
          phone: DEMO_PHONE,
        },
      },
      sb
    );

    await moveCrmLeadToStage(
      { tenantId, leadId: lead.id, toStageId: second.id, changedBy: actorFiUserId, reason: JOURNEY_TAG },
      sb
    );
    await createCrmNoteForLead(
      {
        tenantId,
        leadId: lead.id,
        body: `${JOURNEY_TAG} operator note`,
        authorUserId: actorFiUserId,
      },
      sb
    );
    await createCrmTask(
      {
        tenantId,
        leadId: lead.id,
        title: `${JOURNEY_TAG} follow-up task`,
        assigneeUserId: actorFiUserId,
      },
      sb
    );

    return { leadId: lead.id, personId: lead.person_id, stageId: second.id };
  });

  await runStep(2, "Consultation Booked", async () => {
    const start = perthIso(7, 10);
    const end = perthIso(7, 11);
    const booking = await createBooking(
      {
        tenantId,
        leadId: manifest.leadId,
        personId: manifest.personId,
        bookingType: "consultation",
        title: `${JOURNEY_TAG} SMOKETEST-BOOK-CONSULT-001`,
        startAt: start,
        endAt: end,
        timezone: "Australia/Perth",
        roomRequired: false,
        metadata: { smoketest: JOURNEY_TAG },
        createdByUserId: actorFiUserId,
      },
      sb
    );
    return { consultBookingId: booking.id };
  });

  await runStep(3, "Consultation Completed", async () => {
    const { consultation } = await createConsultationFromBooking(tenantId, manifest.consultBookingId, {
      createdByFiUserId: actorFiUserId,
    });
    const completed = await completeConsultationDraft(tenantId, consultation.id, {
      updatedByFiUserId: actorFiUserId,
    });
    return { consultationId: completed.id };
  });

  await runStep(4, "Patient Created", async () => {
    const conv = await executeCrmLeadConversion(
      {
        tenantId,
        leadId: manifest.leadId,
        seedCase: true,
        caseType: "hair_transplant",
        treatmentInterest: "SMOKETEST FUE",
        conversionNote: JOURNEY_TAG,
        convertedByUserId: actorFiUserId,
      },
      sb
    );
    return {
      patientId: conv.patientId,
      caseId: conv.caseId ?? "",
    };
  });

  await runStep(5, "Images Uploaded", async () => {
    const path = `${tenantId}/smoketest/${manifest.caseId}/SMOKETEST-IMG-001.jpg`;
    const { data, error } = await sb
      .from("fi_patient_images")
      .insert({
        tenant_id: tenantId,
        patient_id: manifest.patientId,
        person_id: manifest.personId,
        case_id: manifest.caseId,
        lead_id: manifest.leadId,
        image_category: "consult",
        storage_bucket: "patient-images",
        storage_path: path,
        original_filename: "SMOKETEST-IMG-001.jpg",
        content_type: "image/jpeg",
        caption: JOURNEY_TAG,
        metadata: { smoketest: JOURNEY_TAG, storage_note: "metadata-only smoketest row" },
        uploaded_by_user_id: actorFiUserId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { patientImageId: String((data as { id: string }).id) };
  });

  await runStep(6, "Treatment Plan Created", async () => {
    await upsertSurgeryPlanForCase(
      {
        tenantId,
        caseId: manifest.caseId,
        patch: {
          planning_status: "in_progress",
          planned_procedure_type: "FUE",
          planning_notes: `${JOURNEY_TAG} SMOKETEST-PLAN-001`,
          surgical_plan_summary: "SMOKETEST surgical plan summary",
        },
      },
      sb
    );
    return { surgeryPlan: "upserted" };
  });

  await runStep(7, "Deposit Recorded", async () => {
    const payment = await createPaymentRecord(
      tenantId,
      {
        payment_context: "surgery",
        patient_id: manifest.patientId,
        lead_id: manifest.leadId,
        consultation_id: manifest.consultationId,
        case_id: manifest.caseId,
        amount_expected: 500,
        amount_paid: 500,
        currency: "AUD",
        status: "paid",
        notes: `${JOURNEY_TAG} SMOKETEST-DEPOSIT-001 manual deposit`,
      },
      actorFiUserId
    );
    return { paymentRecordId: payment.id };
  });

  await runStep(8, "Surgery Booked", async () => {
    const start = perthIso(21, 8);
    const end = perthIso(21, 16);
    const booking = await createBooking(
      {
        tenantId,
        patientId: manifest.patientId,
        caseId: manifest.caseId,
        leadId: manifest.leadId,
        bookingType: "surgery",
        title: `${JOURNEY_TAG} SMOKETEST-BOOK-SURG-001`,
        startAt: start,
        endAt: end,
        timezone: "Australia/Perth",
        roomRequired: false,
        metadata: { smoketest: JOURNEY_TAG, deposit_record_id: manifest.paymentRecordId },
        createdByUserId: actorFiUserId,
      },
      sb
    );
    return { surgeryBookingId: booking.id };
  });

  await runStep(9, "Procedure Day Executed", async () => {
    await upsertProcedureDayForCase(
      {
        tenantId,
        caseId: manifest.caseId,
        patch: {
          procedure_date: perthIso(21).slice(0, 10),
          procedure_status: "completed",
          intraoperative_notes: `${JOURNEY_TAG} SMOKETEST-PROC-001 dry-run procedure day`,
          completion_summary: "SMOKETEST procedure completed",
        },
      },
      sb
    );
    return { procedureDay: "upserted" };
  });

  await runStep(10, "Post-op Review Completed", async () => {
    await upsertPostOpTrackingForCase(
      {
        tenantId,
        caseId: manifest.caseId,
        patch: {
          post_op_status: "routine_follow_up",
          aftercare_notes: `${JOURNEY_TAG} SMOKETEST-POSTOP-001`,
          outcome_notes: "SMOKETEST post-op review complete",
        },
      },
      sb
    );
    return { postOp: "upserted" };
  });

  await runStep(11, "HairAudit Linked (N/A)", async () => {
    await appendCrmActivityEvent(
      {
        tenantId,
        leadId: manifest.leadId,
        caseId: manifest.caseId,
        activityKind: "smoketest.hairaudit_na",
        title: "HairAudit ingest N/A",
        detail: {
          smoketest: JOURNEY_TAG,
          reason: "BLK-LEG-01 legacy API OFF — documented N/A",
        },
      },
      sb
    );
    return { hairAudit: "N/A documented" };
  });

  await runStep(12, "Analytics Updated", async () => {
    const { count: activityCount } = await sb
      .from("fi_crm_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("lead_id", manifest.leadId);
    const { count: analyticsCount } = await sb
      .from("fi_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    return {
      crmActivityEventsForLead: String(activityCount ?? 0),
      analyticsEventsTenant: String(analyticsCount ?? 0),
    };
  });

  const outPath = resolve(
    process.cwd(),
    "docs/production/evidence/attachments/smoketest-journey-manifest-2026-06-30.json"
  );
  writeFileSync(
    outPath,
    JSON.stringify({ journeyTag: JOURNEY_TAG, manifest, results, completedAt: new Date().toISOString() }, null, 2)
  );
  console.log("---");
  console.log(`Manifest written: ${outPath}`);
  console.log(`Steps passed: ${results.filter((r) => r.pass).length}/${results.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});