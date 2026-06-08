/**
 * Patient Twin completeness — **read-only, computed at load time**.
 *
 * Scores how complete and operationally useful the twin projection is. This is not AI inference
 * and does not persist snapshots; it guides operators toward better-linked data.
 */

import type {
  PatientTwinCompletenessMissingArea,
  PatientTwinCompletenessSection,
  PatientTwinV1,
} from "./patientTwinTypes";

export type PatientTwinV1ForCompleteness = Omit<PatientTwinV1, "completeness">;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function bandForScore(score: number): PatientTwinCompletenessSection["band"] {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "partial";
  return "poor";
}

function pushMissing(
  out: PatientTwinCompletenessSection["missing"],
  area: PatientTwinCompletenessMissingArea,
  label: string,
  severity: "info" | "warning" | "important"
) {
  out.push({ area, label, severity });
}

function pushStrength(out: PatientTwinCompletenessSection["strengths"], area: string, label: string) {
  out.push({ area, label });
}

function pushAction(
  out: PatientTwinCompletenessSection["recommended_actions"],
  label: string,
  reason: string,
  priority: "low" | "medium" | "high"
) {
  out.push({ label, reason, priority });
}

/**
 * Derives completeness score, band, gaps, strengths, and suggested next steps from an assembled
 * twin (excluding the `completeness` field). Uses only fields already on the DTO — no I/O.
 */
export function calculatePatientTwinCompleteness(twin: PatientTwinV1ForCompleteness): PatientTwinCompletenessSection {
  const missing: PatientTwinCompletenessSection["missing"] = [];
  const strengths: PatientTwinCompletenessSection["strengths"] = [];
  const recommended_actions: PatientTwinCompletenessSection["recommended_actions"] = [];

  let score = 0;

  // --- Identity (15): name 5, contact 5, source/resolution 5 ---
  let idPts = 0;
  const hasName = Boolean(twin.person.display_name?.trim());
  if (hasName) {
    idPts += 5;
    pushStrength(strengths, "identity", "Display name is present.");
  } else {
    pushMissing(missing, "identity", "Add a display name on the person or patient record.", "warning");
    pushAction(
      recommended_actions,
      "Set patient display name",
      "Improves recognition across CRM, cases, and exports.",
      "medium"
    );
  }

  const hasContact = Boolean(twin.person.email?.trim() || twin.person.phone?.trim());
  if (hasContact) {
    idPts += 5;
    pushStrength(strengths, "identity", "Email or phone is available for outreach.");
  } else {
    pushMissing(missing, "identity", "Add an email or phone number.", "important");
    pushAction(
      recommended_actions,
      "Add contact details",
      "Needed for scheduling and CRM follow-up.",
      "high"
    );
  }

  const hasSourceIds =
    twin.identity_resolution.source_ids.length > 0 ||
    twin.person.source_labels.length > 0 ||
    Boolean(twin.identity_resolution.global_patient_id);
  if (hasSourceIds) {
    idPts += 5;
    pushStrength(strengths, "identity", "Source identifiers or resolution labels are mapped.");
  } else {
    pushMissing(missing, "identity", "Map external source IDs (fi_patient_source_ids) where possible.", "info");
    pushAction(
      recommended_actions,
      "Link source system IDs",
      "Strengthens identity resolution across ingest channels.",
      "low"
    );
  }

  if (twin.identity_resolution.duplicate_risk) {
    pushMissing(missing, "identity", "Possible duplicate or ambiguous resolution — review mappings.", "warning");
  }

  score += idPts;

  // --- CRM (10): any operational signal ---
  const crmSignal =
    twin.crm.active_leads_count > 0 ||
    twin.crm.open_tasks_count > 0 ||
    Boolean(twin.crm.latest_activity_summary?.trim()) ||
    Boolean(twin.crm.latest_lead_status);
  if (crmSignal) {
    score += 10;
    pushStrength(strengths, "crm", "CRM activity, leads, or tasks are linked.");
  } else {
    pushMissing(missing, "crm", "No linked CRM leads, tasks, or recent activity for this patient.", "info");
    pushAction(
      recommended_actions,
      "Connect a CRM lead or log activity",
      "Improves commercial context on the twin.",
      "low"
    );
  }

  // --- Cases (15): cases 10, milestone/timeline 5 ---
  const hasCases = twin.cases.length > 0;
  const hasCaseMilestone = twin.cases.some((c) => c.latest_milestone != null);
  const hasTimeline = twin.timeline.items.length > 0;
  if (hasCases) {
    score += 10;
    pushStrength(strengths, "case", "At least one case is linked.");
  } else {
    pushMissing(missing, "case", "No linked fi_cases for this foundation patient.", "important");
    pushAction(
      recommended_actions,
      "Create or link a case",
      "Cases anchor surgery, media, and audit rollups on the twin.",
      "high"
    );
  }
  if (hasCaseMilestone || hasTimeline) {
    score += 5;
    if (hasCaseMilestone) pushStrength(strengths, "case", "Recent case milestones are visible from the foundation timeline.");
    else if (hasTimeline) pushStrength(strengths, "timeline", "Foundation timeline events provide longitudinal context.");
  } else if (hasCases) {
    pushMissing(missing, "case", "Cases exist but no foundation timeline milestones yet.", "info");
    pushAction(
      recommended_actions,
      "Record timeline milestones",
      "Ingest or create fi_timeline_events so the twin feed is populated.",
      "medium"
    );
  } else if (!hasTimeline) {
    pushMissing(missing, "timeline", "No foundation timeline events in the capped feed.", "info");
  }

  // --- Audit (15): pipeline 10, released report 5 ---
  const auditSignal =
    twin.audits.reports_total > 0 || twin.audits.audits_total > 0 || twin.audits.scorecards_total > 0;
  if (auditSignal) {
    score += 10;
    pushStrength(strengths, "audit", "Reports, audits, or scorecards exist on linked cases.");
  } else {
    pushMissing(missing, "audit", "No reports, audits, or scorecards on linked cases yet.", "warning");
    pushAction(
      recommended_actions,
      "Run or attach audit pipeline outputs",
      "Unlocks HairAudit-style rollup on the twin when cases exist.",
      twin.cases.length > 0 ? "medium" : "low"
    );
  }
  if (twin.audits.latest_released_report != null) {
    score += 5;
    pushStrength(strengths, "audit", "A released report is available.");
  } else if (auditSignal) {
    pushMissing(missing, "audit", "No released report yet (drafts or in-progress only).", "info");
  }

  // --- Media (15): groups 10, latest 5 ---
  const mediaGroups = Object.keys(twin.media.by_asset_type).length;
  const hasLatestMedia = Object.values(twin.media.by_asset_type).some((b) => b.latest != null);
  if (mediaGroups > 0) {
    score += 10;
    pushStrength(strengths, "media", "Unified media is present by asset type.");
  } else {
    pushMissing(missing, "media", "No unified media assets grouped for this patient.", "info");
    pushAction(
      recommended_actions,
      "Upload clinical or intake media",
      "Populates v_fi_media_unified summaries on the twin.",
      twin.cases.length > 0 ? "medium" : "low"
    );
  }
  if (hasLatestMedia) {
    score += 5;
  } else if (mediaGroups > 0) {
    pushMissing(missing, "media", "Media counts exist but latest file metadata is sparse.", "info");
  }

  // --- Clinical (15): structured row 7, scales 4, concern/interest 4 ---
  const sp = twin.clinical.structured_profile;
  let clinPts = 0;
  if (sp) {
    clinPts += 7;
    pushStrength(strengths, "clinical", "Structured clinical profile row exists.");
    const hasScale = Boolean(
      sp.norwood_scale?.trim() || sp.ludwig_scale?.trim() || sp.hairline_pattern?.trim()
    );
    if (hasScale) {
      clinPts += 4;
      pushStrength(strengths, "clinical", "Hair loss scale / pattern fields are populated.");
    } else {
      pushMissing(missing, "clinical", "Norwood / Ludwig / hairline pattern not set.", "info");
    }
    const hasConcernOrInterest = Boolean(sp.primary_concern?.trim() || sp.treatment_interest?.trim());
    if (hasConcernOrInterest) {
      clinPts += 4;
      pushStrength(strengths, "clinical", "Primary concern or treatment interest is captured.");
    } else {
      pushMissing(missing, "clinical", "Primary concern and treatment interest are empty.", "info");
    }
  } else {
    pushMissing(missing, "clinical", "No fi_patient_clinical_details row (bounded fields).", "warning");
    pushAction(
      recommended_actions,
      "Complete structured clinical fields",
      "Norwood/Ludwig and concerns improve handoff without free-text narrative.",
      "medium"
    );
  }
  score += Math.min(15, clinPts);

  if (twin.pathology.requests.length > 0 || twin.pathology.results.length > 0) {
    pushStrength(strengths, "pathology", "Blood pathology requests or results exist for this patient.");
  }

  // --- Timeline (10) ---
  if (twin.timeline.items.length > 0) {
    score += 10;
    pushStrength(strengths, "timeline", "Foundation timeline feed has events.");
  } else {
    pushMissing(missing, "timeline", "Foundation timeline is empty in the current window.", "info");
    if (hasCases) {
      pushAction(
        recommended_actions,
        "Backfill timeline from case events",
        "fi_timeline_events power the longitudinal twin strip.",
        "medium"
      );
    }
  }

  // --- Outcome (5): placeholder — reward structured pipeline readiness only ---
  const outcomeReady = twin.audits.scorecards_total > 0 || twin.audits.latest_released_report != null;
  if (outcomeReady) {
    score += 5;
    pushStrength(strengths, "outcome", "Scorecard or released report indicates outcome-ready pipeline data.");
  } else {
    pushMissing(missing, "outcome", "Outcome indicators are not populated yet (V1 placeholder).", "info");
    pushAction(
      recommended_actions,
      "Plan outcome capture",
      "Future releases can attach normalised outcomes when the model supports it.",
      "low"
    );
  }

  const finalScore = clampScore(score);
  const band = bandForScore(finalScore);

  if (finalScore >= 85) {
    pushStrength(strengths, "summary", "Twin coverage is strong across linked modules.");
  }

  if (finalScore < 40) {
    pushAction(
      recommended_actions,
      "Review twin warnings",
      "Low completeness often aligns with data linkage gaps called out in warnings.",
      "high"
    );
  }

  return {
    score: finalScore,
    band,
    missing,
    strengths,
    recommended_actions,
  };
}
