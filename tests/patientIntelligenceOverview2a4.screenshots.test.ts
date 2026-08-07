/**
 * FI-DEMO-DAY-2A.4 — Static HTML showcase fixtures for Playwright screenshots.
 * Does not require a logged-in app session.
 */

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { chromium } from "playwright";

import {
  SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  SHOWCASE_PACKAGE_A,
  SHOWCASE_PACKAGE_B,
} from "@/src/lib/demo-day/showcaseJamesChenConstants";
import {
  IHRG_SHOWCASE_JAMES_BALANCE_CENTS,
  IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS,
  IHRG_SHOWCASE_JAMES_GRAFT_TARGET,
  IHRG_SHOWCASE_JAMES_QUOTE_CENTS,
  buildIhrgShowcaseJamesPlannedZones,
} from "@/src/lib/ihrg-demo/ihrgShowcaseJamesChenModel";
import { composePatientIntelligenceOverview } from "@/src/lib/patientTwin/patientTwinOverviewComposer";
import {
  formatAudCents,
  formatGraftCount,
  OVERVIEW_SECTION_HEADINGS,
  availabilityLabel,
} from "@/src/lib/patientTwin/patientTwinOverviewCopy";
import type { PatientIntelligenceOverviewModel } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import {
  PATIENT_TWIN_LOADER_VERSION,
  PATIENT_TWIN_VERSION,
  type PatientTwinV1,
} from "@/src/lib/patientTwin/patientTwinTypes";
import { emptyPatientTwinMedicationsSection } from "@/src/lib/patientTwin/patientTwinMedicationOs";
import {
  buildHairProgressionIntelligence,
  HAIR_PROGRESSION_ENGINE_VERSION,
} from "@/src/lib/hair-intelligence/hairProgressionIntelligence";

const OUT_DIR = path.join(
  process.cwd(),
  "docs",
  "audits",
  "screenshots",
  "fi-demo-day-2a4"
);

function emptyTwin(overrides: Partial<PatientTwinV1> = {}): PatientTwinV1 {
  const twin: PatientTwinV1 = {
    version: PATIENT_TWIN_VERSION,
    tenant_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    patient_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    person: {
      person_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      display_name: "Ordinary Patient",
      email: "ordinary@example.com",
      phone: null,
      date_of_birth: null,
      address: null,
      preferred_contact_method: null,
      reminder_consent: null,
      lifecycle_stage: "active",
      lead_status: null,
      stage_of_journey: null,
      import_batch_id: null,
      hubspot_record_id: null,
      source_labels: ["FiOS"],
    },
    identity_resolution: {
      foundation_patient_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      global_patient_id: null,
      source_ids: [],
      duplicate_risk: false,
      resolution_warnings: [],
    },
    crm: {
      active_leads_count: 0,
      latest_lead_status: null,
      latest_lead_stage_label: null,
      open_tasks_count: 0,
      latest_activity_summary: null,
      primary_owner_email: null,
      primary_clinic_display_name: "Test Clinic",
      primary_organisation_name: null,
    },
    cases: [],
    audits: {
      reports_total: 0,
      audits_total: 0,
      reports_by_status: {},
      model_runs_total: 0,
      model_runs_by_status: {},
      scorecards_total: 0,
      latest_released_report: null,
      outcome_indicators: { placeholder: true },
    },
    media: { by_asset_type: {} },
    imaging: {
      active_image_total: 0,
      by_library_axis: {},
      latest_captured_at: null,
      imaging_workspace_href: "/imaging",
      gallery: { items: [], ui_sections: [] },
    },
    photo_protocol: null,
    vie: null,
    pathology: {
      requests: [],
      results: [],
      item_cap: 20,
      results_item_cap: 20,
      abnormal_markers_total: 0,
      last_result_reviewed_at: null,
      latest_ai_interpretation: null,
      latest_medical_intelligence: null,
    },
    timeline: { order: "newest_first", items: [], item_cap: 100 },
    clinical: {
      structured_profile: null,
      medications: emptyPatientTwinMedicationsSection(),
      treatments: [],
      blood_markers: [],
    },
    intelligence: {
      risk_score: null,
      predicted_outcome: null,
      model_outputs: [],
      hair_loss: { latest: null, recent: [], recent_cap: 5 },
      hair_progression: buildHairProgressionIntelligence({
        engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
        timelineCap: 150,
        timepointsRaw: [],
      }),
      donor: { latest: null, recent: [], recent_cap: 5 },
      recipient_candidacy: { latest: null, recent: [], recent_cap: 5 },
      consultation_checklist: { latest: null, recent: [], recent_cap: 5 },
    },
    provenance: {
      generated_at: "2026-08-07T00:00:00.000Z",
      loader_version: PATIENT_TWIN_LOADER_VERSION,
      source_views_used: [],
      source_tables_used: [],
      completeness_score: 40,
    },
    warnings: [],
    completeness: {
      score: 40,
      band: "partial",
      missing: [],
      strengths: [],
      recommended_actions: [],
    },
  };
  return { ...twin, ...overrides };
}

function jamesOverview(pkg: "A" | "B"): PatientIntelligenceOverviewModel {
  const twin = emptyTwin({
    person: { ...emptyTwin().person, display_name: "James Chen" },
    crm: {
      ...emptyTwin().crm,
      primary_clinic_display_name:
        pkg === "A" ? "Sydney Hair Institute" : "Follicle Demo Clinic",
    },
    cases: [
      {
        case_id: `case-${pkg}`,
        global_case_id: null,
        foundation_patient_id: emptyTwin().patient_id,
        global_patient_id: null,
        status: "completed",
        case_type: "surgery",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-31T00:00:00.000Z",
        clinic_display_name:
          pkg === "A" ? "Sydney Hair Institute" : "Follicle Demo Clinic",
        organisation_name: null,
        latest_milestone: null,
      },
    ],
    imaging: {
      ...emptyTwin().imaging,
      active_image_total: 10,
    },
    completeness: {
      score: 92,
      band: "excellent",
      missing: [],
      strengths: [],
      recommended_actions: [],
    },
  });

  return composePatientIntelligenceOverview(twin, {
    presentationMode: true,
    patientMetadata: {
      ...(pkg === "A"
        ? {
            [SHOWCASE_PACKAGE_A.patientKeyField]: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
            [SHOWCASE_PACKAGE_A.showcaseFlag]: true,
            demo_package: "A",
          }
        : {
            [SHOWCASE_PACKAGE_B.patientKeyField]: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
            [SHOWCASE_PACKAGE_B.showcaseFlag]: true,
            demo_package: "B",
          }),
      showcase_age_years: 42,
      showcase_staging_label: "Norwood 3V–4",
    },
    plannedZones: buildIhrgShowcaseJamesPlannedZones(),
    surgeryPlan: {
      planningStatus: "approved",
      plannedProcedureType: "FUE",
      surgicalPlanSummary: "2,800 graft FUE with natural mature hairline.",
      planningNotes: null,
      estimatedGraftsMin: IHRG_SHOWCASE_JAMES_GRAFT_TARGET,
      estimatedGraftsMax: IHRG_SHOWCASE_JAMES_GRAFT_TARGET,
      hairlineStatus: "approved",
    },
    surgery: {
      surgeryDate: "2026-07-31T08:00:00.000Z",
      surgeryStatus: "completed",
      technique: "FUE",
      implantedGrafts: IHRG_SHOWCASE_JAMES_GRAFT_TARGET,
      extractedGrafts: 2860,
      discardedGrafts: 60,
      transectionRatePercent: 2.1,
    },
    workforceMembers: [
      {
        role: "surgeon",
        displayName: pkg === "A" ? "Dr Sydney Lead Surgeon" : "Clinic Lead Surgeon",
        competencyValidOnProcedureDate: true,
      },
      {
        role: "nurse",
        displayName: pkg === "A" ? "Sydney Lead Nurse" : "Clinic Lead Nurse",
        competencyValidOnProcedureDate: true,
      },
      {
        role: "technician",
        displayName: pkg === "A" ? "Sydney Technician" : "Clinic Technician",
        competencyValidOnProcedureDate: true,
      },
    ],
    invoices: [
      {
        invoice_kind: "consultation_quote",
        title: "Quote",
        status: "paid",
        total_cents: IHRG_SHOWCASE_JAMES_QUOTE_CENTS,
        amount_paid_cents: IHRG_SHOWCASE_JAMES_QUOTE_CENTS,
        currency: "AUD",
        metadata: {},
      },
      {
        invoice_kind: "surgery_deposit",
        title: "Deposit",
        status: "paid",
        total_cents: IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS,
        amount_paid_cents: IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS,
        currency: "AUD",
        metadata: {},
      },
      {
        invoice_kind: "surgery_balance",
        title: "Balance",
        status: "paid",
        total_cents: IHRG_SHOWCASE_JAMES_BALANCE_CENTS,
        amount_paid_cents: IHRG_SHOWCASE_JAMES_BALANCE_CENTS,
        currency: "AUD",
        metadata: {},
      },
    ],
    projectedOutcome: { status: "approved", graftTarget: 2800 },
    outcomeMeasurements: [
      {
        id: "m3",
        checkpoint_key: "month_3",
        measurement_date: "2026-10-31",
        metric_values: {
          observation_status: "projected_fixture",
          density_percent_of_target: 72,
          patient_satisfaction_10: 8,
        },
        metadata: { future_dated_fixture: true },
      },
      {
        id: "m6",
        checkpoint_key: "month_6",
        measurement_date: "2027-01-31",
        metric_values: {
          observation_status: "projected_fixture",
          density_percent_of_target: 91,
          patient_satisfaction_10: 9,
        },
        metadata: { future_dated_fixture: true },
      },
    ],
  });
}

function renderHtml(title: string, overview: PatientIntelligenceOverviewModel): string {
  const s = overview.summary;
  const o = overview.outcomes;
  const e = overview.economics;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { margin:0; font-family: Inter, Segoe UI, sans-serif; background:#070b14; color:#e2e8f0; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .card { border:1px solid rgba(255,255,255,.1); background:#0b1220; border-radius:14px; padding:16px; margin-bottom:14px; }
    .badge { display:inline-block; border:1px solid rgba(56,189,248,.4); background:rgba(14,165,233,.15); color:#bae6fd; border-radius:8px; padding:3px 8px; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
    .future { border-color: rgba(56,189,248,.45); background: rgba(8,47,73,.45); }
    h1 { margin:0 0 8px; font-size:28px; }
    h2 { margin:0 0 8px; font-size:16px; }
    .muted { color:#94a3b8; font-size:13px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
    .kpi { border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:10px; background:#0006; }
    .kpi b { display:block; font-size:11px; color:#64748b; text-transform:uppercase; }
  </style>
</head>
<body>
  <main class="wrap" data-testid="patient-intelligence-overview" data-demo-package="${overview.demoPackage ?? "none"}">
    <section class="card">
      <div class="muted">Health record · Overview</div>
      <h1>${s.displayName}${s.ageYears != null ? `, ${s.ageYears}` : ""}</h1>
      <div>${s.stagingLabel ? `<span class="badge">${s.stagingLabel}</span> ` : ""}${
        s.showcase.isShowcase ? `<span class="badge">Demo showcase</span> ` : ""
      }${s.packageContextLabel ? `<span class="badge">${s.packageContextLabel}</span>` : ""}</div>
      <p class="muted">${s.clinicalStatusLabel} · Completeness ${s.completenessScore} ${s.completenessBand}</p>
    </section>
    <section class="card">
      <h2>${OVERVIEW_SECTION_HEADINGS.surgicalPlan}</h2>
      <p>${overview.surgicalPlan.recommendationSummary ?? "Not recorded"}</p>
      <p class="muted">Planned grafts: ${
        overview.surgicalPlan.plannedGrafts != null
          ? formatGraftCount(overview.surgicalPlan.plannedGrafts)
          : "Not recorded"
      } · ${overview.surgicalPlan.hairlineLabel ?? "Hairline not recorded"}</p>
    </section>
    <section class="card">
      <h2>${OVERVIEW_SECTION_HEADINGS.procedure}</h2>
      <p class="muted">${overview.procedure.graftReconciliationLabel ?? "Not recorded"}</p>
    </section>
    <section class="card">
      <h2>${OVERVIEW_SECTION_HEADINGS.outcomes}</h2>
      <p>${o.projectedOutcome.label}</p>
      ${o.milestones
        .map(
          (m) => `<div class="card future"><strong>${m.label}</strong>
        <div class="badge">${m.evidenceBadge}</div>
        <p class="muted">${m.measurementDate ?? ""} · not a completed patient follow-up</p></div>`
        )
        .join("")}
    </section>
    <section class="card">
      <h2>${OVERVIEW_SECTION_HEADINGS.economics}</h2>
      <div class="grid">
        <div class="kpi"><b>Quote</b>${
          e.quoteCents != null ? formatAudCents(e.quoteCents) : availabilityLabel("not_recorded")
        }</div>
        <div class="kpi"><b>Deposit</b>${
          e.depositCents != null ? formatAudCents(e.depositCents) : availabilityLabel("not_recorded")
        }</div>
        <div class="kpi"><b>Balance</b>${
          e.balanceCents != null ? formatAudCents(e.balanceCents) : availabilityLabel("not_recorded")
        }</div>
        <div class="kpi"><b>Paid</b>${formatAudCents(e.paidTotalCents)}</div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

describe("FI-DEMO-DAY-2A.4 screenshots", () => {
  it("writes Package A/B/ordinary desktop and mobile screenshots", async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const fixtures: Array<{ name: string; overview: PatientIntelligenceOverviewModel }> = [
      { name: "package-a-james-chen", overview: jamesOverview("A") },
      { name: "package-b-james-chen", overview: jamesOverview("B") },
      { name: "ordinary-patient", overview: composePatientIntelligenceOverview(emptyTwin()) },
    ];

    const browser = await chromium.launch({ headless: true });
    try {
      for (const fixture of fixtures) {
        const htmlPath = path.join(OUT_DIR, `${fixture.name}.html`);
        writeFileSync(htmlPath, renderHtml(fixture.name, fixture.overview), "utf8");

        for (const viewport of [
          { label: "desktop", width: 1440, height: 900 },
          { label: "mobile", width: 390, height: 844 },
        ]) {
          const page = await browser.newPage({
            viewport: { width: viewport.width, height: viewport.height },
          });
          await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`);
          const shot = path.join(OUT_DIR, `${fixture.name}-${viewport.label}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          await page.close();
        }
      }

      // Presentation width (1920)
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      const htmlPath = path.join(OUT_DIR, "package-a-james-chen.html");
      await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`);
      await page.screenshot({
        path: path.join(OUT_DIR, "package-a-james-chen-presentation-1920.png"),
        fullPage: true,
      });
      await page.close();
    } finally {
      await browser.close();
    }

    assert.ok(true);
  });
});
