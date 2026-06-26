import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { protocolRequiredCompletionPercent, slotIsSatisfied } from "@/src/lib/imagingOs/imagingOsProtocol";
import {
  computeConsultationCompleteness,
  computeDonorDocumentationCompleteness,
  computeFullHeadSeriesCompleteness,
  computeSurgeryPhaseCompleteness,
  computeSurgicalDocumentationCompleteness,
  protocolCompletenessFromProgress,
} from "./vieCompleteness";
import {
  countRequiredProtocolSlots,
  getVieProtocolOrThrow,
  groupSurgeryDaySlotsByPhase,
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
      ["front", "left_side", "right_side", "top", "crown", "donor"]
    );
    assert.equal(countRequiredProtocolSlots(protocol), 6);
    assert.ok(protocol.slots.every((s) => s.capture_distance_hint && s.framing));
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
    assert.ok(protocol.slots.filter((s) => s.framing === "close_up").length === 5);
  });

  it("planning protocol includes required donor add-ons separate from primary views", () => {
    const protocol = getVieProtocolOrThrow("hair_transplant_planning");
    const primary = protocol.slots.filter((s) => s.slot_tier === "primary");
    const donorSlots = protocol.slots.filter((s) => s.slot_tier === "addon");
    assert.equal(primary.length, 3);
    assert.deepEqual(
      donorSlots.map((s) => s.slug),
      ["donor", "donor_close"]
    );
    assert.ok(donorSlots.every((s) => s.required));
    assert.ok(primary.every((s) => !isDonorDocumentationSlot(s.slug)));
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

  it("surgery day slots group into six operative phases", () => {
    const protocol = getVieProtocolOrThrow("surgery_day");
    const groups = groupSurgeryDaySlotsByPhase(protocol.slots);
    assert.deepEqual(
      groups.map((g) => g.phase),
      ["pre_op", "design", "extraction", "graft_handling", "implantation", "immediate_post_op"]
    );
    assert.equal(groups.find((g) => g.phase === "graft_handling")?.slots.length, 2);
    assert.equal(groups.find((g) => g.phase === "pre_op")?.slots.length, 12);
  });

  it("identifies donor documentation slots", () => {
    assert.equal(isDonorDocumentationSlot("donor"), true);
    assert.equal(isDonorDocumentationSlot("donor_close"), true);
    assert.equal(isDonorDocumentationSlot("pre_op_donor_close"), true);
    assert.equal(isDonorDocumentationSlot("graft_tray_overview"), false);
    assert.equal(isDonorDocumentationSlot("front"), false);
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

  it("pending / unaccepted images do not count toward completeness", () => {
    const progress = {
      front: ["accepted-id"],
      left_side: ["accepted-id-2"],
      __meta__: {
        vie_pending: {
          right_side: {
            patient_image_id: "pending-id",
            intelligence_id: "intel-1",
            captured_at: new Date().toISOString(),
            quality_score: 92,
            quality_band: "excellent",
            clinically_usable: true,
          },
        },
      },
    };
    const domain = computeConsultationCompleteness([{ template_slug: "baseline_consultation", progress }]);
    assert.equal(domain.required_total, 6);
    assert.equal(domain.required_complete, 2);
    assert.equal(slotIsSatisfied({ slug: "right_side", label: "Right side", required: true }, progress), false);
  });

  it("initial consult completeness stays at 6 required views", () => {
    const progress = {
      front: ["a"],
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

  it("full clinical head series tracked separately from consultation", () => {
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

    const headSeries = computeFullHeadSeriesCompleteness([
      { template_slug: "full_clinical_head_series", progress },
    ]);
    assert.equal(headSeries.required_total, 10);
    assert.equal(headSeries.required_complete, 8);

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
    const domain = computeSurgicalDocumentationCompleteness([{ template_slug: "surgery_day", progress }]);
    assert.equal(domain.required_total, surgery.slots.length);
    assert.equal(domain.required_complete, 3);
    assert.equal(domain.percent, Math.round((3 / surgery.slots.length) * 100));
  });

  it("surgery phase groups calculate completeness independently", () => {
    const progress = {
      pre_op_front: ["p1"],
      pre_op_front_close: ["p2"],
      hairline_design: ["d1"],
      graft_tray_overview: ["g1"],
      graft_tray_close: ["g2"],
    };
    const groups = computeSurgeryPhaseCompleteness([{ template_slug: "surgery_day", progress }]);

    const preOp = groups.find((g) => g.phase === "pre_op");
    assert.ok(preOp);
    assert.equal(preOp!.required_total, 12);
    assert.equal(preOp!.required_complete, 2);

    const design = groups.find((g) => g.phase === "design");
    assert.ok(design);
    assert.equal(design!.required_complete, 1);
    assert.equal(design!.percent, 100);

    const graftHandling = groups.find((g) => g.phase === "graft_handling");
    assert.ok(graftHandling);
    assert.equal(graftHandling!.required_complete, 2);
    assert.equal(graftHandling!.percent, 100);

    const extraction = groups.find((g) => g.phase === "extraction");
    assert.ok(extraction);
    assert.equal(extraction!.required_complete, 0);
    assert.equal(extraction!.percent, 0);
  });
});
