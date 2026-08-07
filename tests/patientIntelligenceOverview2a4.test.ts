/**
 * FI-DEMO-DAY-2A.4 — Patient Intelligence Overview composition & copy tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
import { detectShowcasePatient } from "@/src/lib/patientTwin/patientTwinShowcaseDetection";
import { composePatientIntelligenceOverview } from "@/src/lib/patientTwin/patientTwinOverviewComposer";
import { composeOverviewEconomics } from "@/src/lib/patientTwin/patientTwinEconomicsCore";
import {
  composeOverviewOutcomes,
  isDemonstrationOrFutureMilestone,
  resolveOutcomeEvidenceKind,
} from "@/src/lib/patientTwin/patientTwinOutcomesCore";
import { buildOverviewDeepLinks } from "@/src/lib/patientTwin/patientTwinOverviewDeepLinks";
import {
  findProhibitedBrandHits,
  overviewStaffCopyCorpus,
  OVERVIEW_SECTION_HEADINGS,
} from "@/src/lib/patientTwin/patientTwinOverviewCopy";
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

describe("patientTwinShowcaseDetection", () => {
  it("detects Package A James via demo_patient_key + enterprise flag", () => {
    const result = detectShowcasePatient({
      patientMetadata: {
        [SHOWCASE_PACKAGE_A.patientKeyField]: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
        [SHOWCASE_PACKAGE_A.showcaseFlag]: true,
        demo_package: "A",
      },
    });
    assert.equal(result.isShowcase, true);
    assert.equal(result.isJamesChenShowcase, true);
    assert.equal(result.demoPackage, "A");
  });

  it("detects Package B James via clinic_demo_patient_key", () => {
    const result = detectShowcasePatient({
      patientMetadata: {
        [SHOWCASE_PACKAGE_B.patientKeyField]: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
        [SHOWCASE_PACKAGE_B.showcaseFlag]: true,
        demo_package: "B",
      },
    });
    assert.equal(result.isShowcase, true);
    assert.equal(result.demoPackage, "B");
  });

  it("does not treat ordinary patients as showcase", () => {
    const result = detectShowcasePatient({
      patientMetadata: { some_other_key: "value" },
    });
    assert.equal(result.isShowcase, false);
    assert.equal(result.isJamesChenShowcase, false);
  });
});

describe("overview economics + graft reconciliation", () => {
  it("reconciles three paid invoices to quote / deposit / balance AUD", () => {
    const economics = composeOverviewEconomics({
      paymentsHref: "/payments",
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
    });
    assert.equal(economics.invoiceCount, 3);
    assert.equal(economics.quoteCents, IHRG_SHOWCASE_JAMES_QUOTE_CENTS);
    assert.equal(economics.depositCents, IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS);
    assert.equal(economics.balanceCents, IHRG_SHOWCASE_JAMES_BALANCE_CENTS);
    assert.equal(economics.reconciled, true);
    assert.equal(economics.paidTotalCents, IHRG_SHOWCASE_JAMES_QUOTE_CENTS);
    assert.equal(
      (economics.depositCents ?? 0) + (economics.balanceCents ?? 0),
      economics.quoteCents
    );
  });

  it("reconciles planned 2,800 grafts for Package A and Package B story inputs", () => {
    for (const pkg of ["A", "B"] as const) {
      const twin = emptyTwin({
        person: {
          ...emptyTwin().person,
          display_name: "James Chen",
        },
        cases: [
          {
            case_id: `case-${pkg}`,
            global_case_id: null,
            foundation_patient_id: emptyTwin().patient_id,
            global_patient_id: null,
            status: "active",
            case_type: "surgery",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-31T00:00:00.000Z",
            clinic_display_name: pkg === "A" ? "Sydney Hair Institute" : "Follicle Demo Clinic",
            organisation_name: null,
            latest_milestone: null,
          },
        ],
      });
      const overview = composePatientIntelligenceOverview(twin, {
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
          surgeryDate: "2026-07-31T00:00:00.000Z",
          surgeryStatus: "completed",
          technique: "FUE",
          implantedGrafts: IHRG_SHOWCASE_JAMES_GRAFT_TARGET,
          extractedGrafts: 2860,
          discardedGrafts: 60,
          transectionRatePercent: 2.1,
        },
      });
      assert.equal(overview.demoPackage, pkg);
      assert.equal(overview.surgicalPlan.plannedGrafts, 2800);
      assert.equal(overview.procedure.graftsReconciledToPlan, true);
      assert.equal(overview.summary.showcase.isJamesChenShowcase, true);
      // Tenant identity stays on the twin — never cross-wired.
      assert.equal(overview.tenantId, twin.tenant_id);
    }
  });
});

describe("future fixture labelling", () => {
  it("labels future_dated_fixture / projected_fixture as demonstration milestones", () => {
    const outcomes = composeOverviewOutcomes({
      measurements: [
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
      projected: { status: "approved", graftTarget: 2800 },
    });

    assert.equal(outcomes.milestones.length, 2);
    for (const m of outcomes.milestones) {
      assert.equal(isDemonstrationOrFutureMilestone(m), true);
      assert.match(m.evidenceBadge, /Demonstration|Future demonstration/i);
      assert.notEqual(m.evidenceKind, "observed_clinical");
      assert.equal(m.availability, "planned_future");
    }
    assert.equal(
      resolveOutcomeEvidenceKind({
        id: "x",
        checkpoint_key: "month_3",
        measurement_date: "2026-10-31",
        metric_values: { observation_status: "observed" },
        metadata: {},
      }),
      "observed_clinical"
    );
  });
});

describe("missing / partial records + ordinary patient regression", () => {
  it("keeps ordinary non-showcase patients useful with not-recorded empty states", () => {
    const overview = composePatientIntelligenceOverview(emptyTwin());
    assert.equal(overview.summary.showcase.isShowcase, false);
    assert.equal(overview.baseline.availability, "not_recorded");
    assert.equal(overview.surgicalPlan.availability, "not_recorded");
    assert.equal(overview.procedure.availability, "not_recorded");
    assert.equal(overview.economics.availability, "not_recorded");
    assert.equal(overview.outcomes.availability, "not_recorded");
    assert.equal(OVERVIEW_SECTION_HEADINGS.economics, "Money");
  });

  it("partial surgical plan without graft session stays partial without inventing grafts", () => {
    const twin = emptyTwin({
      cases: [
        {
          case_id: "case-partial",
          global_case_id: null,
          foundation_patient_id: emptyTwin().patient_id,
          global_patient_id: null,
          status: "planning",
          case_type: "surgery",
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
          clinic_display_name: "Test Clinic",
          organisation_name: null,
          latest_milestone: null,
        },
      ],
    });
    const overview = composePatientIntelligenceOverview(twin, {
      surgeryPlan: {
        planningStatus: "draft",
        plannedProcedureType: "FUE",
        surgicalPlanSummary: null,
        planningNotes: "Draft only",
        estimatedGraftsMin: null,
        estimatedGraftsMax: null,
        hairlineStatus: null,
      },
    });
    assert.equal(overview.surgicalPlan.availability, "recorded");
    assert.equal(overview.surgicalPlan.plannedGrafts, null);
    assert.equal(overview.procedure.availability, "not_recorded");
  });
});

describe("cross-tenant isolation", () => {
  it("keeps Package A and Package B overview models tenant-isolated", () => {
    const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const tenantB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const patientA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const patientB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const overviewA = composePatientIntelligenceOverview(
      emptyTwin({
        tenant_id: tenantA,
        patient_id: patientA,
        person: { ...emptyTwin().person, display_name: "James Chen" },
      }),
      {
        patientMetadata: {
          demo_patient_key: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
          enterprise_demo_showcase: true,
          demo_package: "A",
        },
      }
    );
    const overviewB = composePatientIntelligenceOverview(
      emptyTwin({
        tenant_id: tenantB,
        patient_id: patientB,
        person: { ...emptyTwin().person, display_name: "James Chen" },
      }),
      {
        patientMetadata: {
          clinic_demo_patient_key: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
          clinic_demo_showcase: true,
          demo_package: "B",
        },
      }
    );

    assert.equal(overviewA.tenantId, tenantA);
    assert.equal(overviewB.tenantId, tenantB);
    assert.notEqual(overviewA.patientId, overviewB.patientId);
    assert.equal(overviewA.demoPackage, "A");
    assert.equal(overviewB.demoPackage, "B");
  });
});

describe("deep links + prohibited brands", () => {
  it("builds tenant-scoped deep links to existing destinations", () => {
    const links = buildOverviewDeepLinks({
      tenantId: "tid",
      patientId: "pid",
      caseId: "cid",
      latestAuditReportId: "rid",
    });
    assert.equal(links.patientProfileHref, "/fi-admin/tid/patients/pid");
    assert.equal(links.paymentsHref, "/fi-admin/tid/patients/pid?tab=payments");
    assert.equal(links.imagingHref, "/fi-admin/tid/patients/pid/imaging");
    assert.equal(links.caseHref, "/fi-admin/tid/cases/cid");
    assert.match(links.surgeryPlanningHref ?? "", /#case-surgery-planning$/);
    assert.match(links.surgeryDayHref ?? "", /#case-procedure-day$/);
    assert.match(links.auditHref ?? "", /\/audit\/rid$/);
  });

  it("staff copy corpus excludes Demo Day prohibited brands and Digital Twin chrome", () => {
    const corpus = overviewStaffCopyCorpus().join("\n");
    assert.equal(findProhibitedBrandHits(corpus).length, 0);
    assert.doesNotMatch(corpus, /LeadFlow|HairIntel|AuditOS|AcademyOS|ClinicOS|AnalyticsOS/i);
    assert.doesNotMatch(corpus, /Digital Twin|Patient Twin/i);
    assert.match(corpus, /Health record/);
    assert.match(corpus, /Money/);
  });
});
