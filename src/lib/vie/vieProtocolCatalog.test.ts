import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { protocolRequiredCompletionPercent, slotIsSatisfied } from "@/src/lib/imagingOs/imagingOsProtocol";
import {
  computeConsultationCompleteness,
  computeDonorDocumentationCompleteness,
  computeSurgicalDocumentationCompleteness,
  protocolCompletenessFromProgress,
} from "./vieCompleteness";
import {
  countRequiredProtocolSlots,
  getVieProtocolOrThrow,
  isDonorDocumentationSlot,
} from "./vieProtocolCatalog";

describe("VIE protocol catalog", () => {
  it("initial consult expects 6 required primary views", () => {
    const protocol = getVieProtocolOrThrow("baseline_consultation");
    assert.match(protocol.name, /initial.*baseline/i);
    assert.equal(protocol.slots.length, 6);
    assert.ok(protocol.slots.every((s) => s.required && s.slot_tier === "primary"));
    assert.deepEqual(
      protocol.slots.map((s) => s.slug),
      ["front_hairline", "left_side", "right_side", "top", "crown", "donor"]
    );
    assert.equal(countRequiredProtocolSlots(protocol), 6);
  });

  it("full clinical head series expects 10 required primary views", () => {
    const protocol = getVieProtocolOrThrow("full_clinical_head_series");
    assert.equal(protocol.slots.length, 10);
    assert.ok(protocol.slots.every((s) => s.required && s.slot_tier === "primary"));
    assert.deepEqual(
      protocol.slots.map((s) => s.slug),
      [
        "front",
        "front_close",
        "top",
        "top_close",
        "left_side",
        "left_side_close",
        "right_side",
        "right_side_close",
        "crown",
        "crown_close",
      ]
    );
    assert.equal(countRequiredProtocolSlots(protocol), 10);
  });

  it("planning protocol includes required donor add-ons", () => {
    const protocol = getVieProtocolOrThrow("hair_transplant_planning");
    const donorSlots = protocol.slots.filter((s) => s.slot_tier === "addon");
    assert.deepEqual(
      donorSlots.map((s) => s.slug),
      ["donor", "donor_close"]
    );
    assert.ok(donorSlots.every((s) => s.required));
  });

  it("surgery day protocol includes graft tray and operative documentation slots", () => {
    const protocol = getVieProtocolOrThrow("surgery_day");
    const slugs = protocol.slots.map((s) => s.slug);

    assert.ok(slugs.includes("graft_tray_overview"));
    assert.ok(slugs.includes("graft_tray_close"));
    assert.ok(slugs.includes("donor_before_extraction"));
    assert.ok(slugs.includes("donor_during_extraction"));
    assert.ok(slugs.includes("donor_final_extraction"));
    assert.ok(slugs.includes("recipient_sites"));
    assert.ok(slugs.includes("hairline_design"));
    assert.ok(slugs.includes("immediate_post_op_front"));
    assert.ok(slugs.includes("immediate_post_op_donor"));
    assert.equal(slugs.filter((s) => s.startsWith("pre_op_")).length, 12);
    assert.equal(countRequiredProtocolSlots(protocol), slugs.length);
  });

  it("identifies donor documentation slots", () => {
    assert.equal(isDonorDocumentationSlot("donor"), true);
    assert.equal(isDonorDocumentationSlot("donor_close"), true);
    assert.equal(isDonorDocumentationSlot("pre_op_donor_close"), true);
    assert.equal(isDonorDocumentationSlot("graft_tray_overview"), false);
    assert.equal(isDonorDocumentationSlot("front_hairline"), false);
  });
});

describe("VIE completeness scoring", () => {
  it("scores required slots only — optional slots do not reduce completeness", () => {
    const followUp = getVieProtocolOrThrow("follow_up_review");
    const requiredOnlyProgress = {
      fu_front: ["img-1"],
      fu_top: ["img-2"],
    };
    const slots = followUp.slots.map((s) => ({
      slug: s.slug,
      label: s.label,
      required: s.required,
    }));
    assert.equal(protocolRequiredCompletionPercent(slots, requiredOnlyProgress), 100);
    assert.equal(
      slotIsSatisfied({ slug: "fu_donor", label: "Donor", required: false }, requiredOnlyProgress),
      false
    );

    const withOptional = { ...requiredOnlyProgress, fu_donor: ["img-3"] };
    assert.equal(protocolRequiredCompletionPercent(slots, withOptional), 100);
  });

  it("initial consult completeness stays at 6 required views", () => {
    const progress = {
      front_hairline: ["a"],
      left_side: ["b"],
      right_side: ["c"],
      top: ["d"],
      crown: ["e"],
    };
    const domain = computeConsultationCompleteness([{ template_slug: "baseline_consultation", progress }]);
    assert.equal(domain.required_total, 6);
    assert.equal(domain.required_complete, 5);
    assert.equal(domain.percent, 83);
  });

  it("full clinical protocol can require more images without affecting consult score", () => {
    const clinical = getVieProtocolOrThrow("full_clinical_head_series");
    const progress = Object.fromEntries(clinical.slots.slice(0, 8).map((s) => [s.slug, ["img"]]));
    const result = protocolCompletenessFromProgress(
      clinical.slug,
      clinical.name,
      clinical.slots.map((s) => ({ slug: s.slug, label: s.label, required: s.required })),
      progress
    );
    assert.equal(result.required_total, 10);
    assert.equal(result.required_complete, 8);
    assert.equal(result.percent, 80);

    const consult = computeConsultationCompleteness([{ template_slug: "full_clinical_head_series", progress }]);
    assert.equal(consult.required_total, 6);
    assert.equal(consult.required_complete, 0);
  });

  it("donor documentation aggregates required add-on slots across surgical protocols", () => {
    const planningProgress = { donor: ["d1"] };
    const domain = computeDonorDocumentationCompleteness([
      { template_slug: "hair_transplant_planning", progress: planningProgress },
    ]);
    assert.ok(domain.required_total >= 2);
    assert.equal(domain.required_complete, 1);
    assert.ok(domain.percent < 100);
  });

  it("surgical documentation tracks surgery day required slots", () => {
    const surgery = getVieProtocolOrThrow("surgery_day");
    const progress = {
      graft_tray_overview: ["g1"],
      graft_tray_close: ["g2"],
      recipient_sites: ["r1"],
    };
    const domain = computeSurgicalDocumentationCompleteness([
      { template_slug: "surgery_day", progress },
    ]);
    assert.equal(domain.required_total, surgery.slots.length);
    assert.equal(domain.required_complete, 3);
    assert.equal(domain.percent, Math.round((3 / surgery.slots.length) * 100));
  });
});
