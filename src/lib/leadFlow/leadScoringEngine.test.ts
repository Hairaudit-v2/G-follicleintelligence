import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveLeadPriorityBand, scoreLead } from "@/src/lib/leadFlow/leadScoringEngine";

const baseInput = {
  procedure_interest: null as string | null,
  lead_source: null as string | null,
  country: null as string | null,
  budget_range: null as string | null,
  current_stage: "new" as string | null,
  email: null as string | null,
  phone: null as string | null,
  first_name: null as string | null,
  last_name: null as string | null,
};

describe("leadScoringEngine", () => {
  it("transplant lead scores high", () => {
    const result = scoreLead({
      ...baseInput,
      procedure_interest: "FUE hairline transplant",
      email: "patient@example.com",
      phone: "61400111222",
      budget_range: "high / surgery-ready",
      country: "Australia",
    });

    assert.equal(result.predicted_procedure, "fue_transplant");
    assert.ok(result.lead_score >= 70);
    assert.equal(result.priority_band, "high");
    assert.ok(result.scoring_reasons.some((r) => r.includes("FUE")));
  });

  it("repair case becomes predicted_procedure repair_case", () => {
    const result = scoreLead({
      ...baseInput,
      procedure_interest: "bad transplant repair with donor damage",
      email: "repair@example.com",
      phone: "61400111223",
    });

    assert.equal(result.predicted_procedure, "repair_case");
    assert.ok(result.scoring_reasons.some((r) => r.includes("Repair")));
    assert.ok(result.lead_score >= 40);
  });

  it("PRP interest predicted correctly", () => {
    const result = scoreLead({
      ...baseInput,
      procedure_interest: "PRP therapy",
      email: "prp@example.com",
    });

    assert.equal(result.predicted_procedure, "prp");
    assert.ok(result.scoring_reasons.some((r) => r.includes("PRP")));
  });

  it("exosomes interest predicted correctly", () => {
    const result = scoreLead({
      ...baseInput,
      procedure_interest: "Exosome treatment",
      email: "exo@example.com",
    });

    assert.equal(result.predicted_procedure, "exosomes");
    assert.ok(result.scoring_reasons.some((r) => r.includes("Exosome")));
  });

  it("missing phone and email produce risk flags", () => {
    const result = scoreLead({
      ...baseInput,
      procedure_interest: "FUE",
    });

    assert.ok(result.risk_flags.includes("missing_phone"));
    assert.ok(result.risk_flags.includes("missing_email"));
  });

  it("local Australia lead gets local boost", () => {
    const local = scoreLead({
      ...baseInput,
      country: "Australia",
      email: "local@example.com",
    });
    const international = scoreLead({
      ...baseInput,
      country: "United Kingdom",
      email: "intl@example.com",
    });

    assert.ok(local.lead_score > international.lead_score);
    assert.ok(local.scoring_reasons.some((r) => r.includes("Australia")));
    assert.ok(international.risk_flags.includes("international_lead"));
  });

  it("consultation booked increases conversion probability", () => {
    const baseline = scoreLead({
      ...baseInput,
      email: "stage@example.com",
      phone: "61400999888",
      current_stage: "new",
    });
    const booked = scoreLead({
      ...baseInput,
      email: "stage@example.com",
      phone: "61400999888",
      current_stage: "consultation_booked",
    });

    assert.ok(booked.lead_score > baseline.lead_score);
    assert.ok(booked.conversion_probability > baseline.conversion_probability);
    assert.ok(booked.scoring_reasons.some((r) => r.includes("Consultation booked")));
  });

  it("priority band thresholds work", () => {
    assert.equal(resolveLeadPriorityBand(84), "high");
    assert.equal(resolveLeadPriorityBand(85), "urgent");
    assert.equal(resolveLeadPriorityBand(69), "medium");
    assert.equal(resolveLeadPriorityBand(44), "low");
    assert.equal(resolveLeadPriorityBand(45), "medium");
    assert.equal(resolveLeadPriorityBand(70), "high");
  });

  it("scoring is deterministic", () => {
    const input = {
      ...baseInput,
      procedure_interest: "crown FUE transplant",
      email: "det@example.com",
      phone: "61400777666",
      budget_range: "20000",
      country: "AU",
      current_stage: "proposal_sent",
    };
    const a = scoreLead(input);
    const b = scoreLead(input);

    assert.deepEqual(a, b);
  });
});
