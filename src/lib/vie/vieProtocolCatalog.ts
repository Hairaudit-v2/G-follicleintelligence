import type { VieCaptureGuideKind, VieProtocolDef, VieProtocolSlotDef, VieProtocolSlug } from "./vieProtocolTypes";
import { VIE_PROTOCOL_SLUGS } from "./vieProtocolTypes";

export { VIE_PROTOCOL_SLUGS };

function slot(
  slug: string,
  label: string,
  instruction: string,
  capture_guide: VieCaptureGuideKind,
  suggested_region: string,
  opts?: { required?: boolean; slot_tier?: VieProtocolSlotDef["slot_tier"] }
): VieProtocolSlotDef {
  const required = opts?.required !== false;
  const slot_tier = opts?.slot_tier ?? (required ? "primary" : "optional");
  return { slug, label, required, slot_tier, suggested_region, instruction, capture_guide };
}

function preOpHeadSeries(): VieProtocolSlotDef[] {
  const pairs: Array<[string, string, VieCaptureGuideKind, VieCaptureGuideKind, string]> = [
    ["pre_op_front", "Pre-op — front", "front_hairline", "front_close", "hairline"],
    ["pre_op_top", "Pre-op — top", "top", "top_close", "midscalp"],
    ["pre_op_left_side", "Pre-op — left side", "left_side", "left_side_close", "temple_left"],
    ["pre_op_right_side", "Pre-op — right side", "right_side", "right_side_close", "temple_right"],
    ["pre_op_crown", "Pre-op — crown", "crown", "crown_close", "crown"],
  ];
  const out: VieProtocolSlotDef[] = [];
  for (const [base, label, wideGuide, closeGuide, region] of pairs) {
    out.push(
      slot(
        base,
        label,
        `Capture ${label.toLowerCase()} before anaesthesia. Match clinical head-series framing with even lighting.`,
        wideGuide,
        region
      ),
      slot(
        `${base}_close`,
        `${label} (close-up)`,
        `Close-up of the same ${label.replace("Pre-op — ", "").toLowerCase()} zone for density and surface detail.`,
        closeGuide,
        region
      )
    );
  }
  return out;
}

/** Canonical VIE protocol catalog — source of truth for Phase 1 slot definitions. */
export const VIE_PROTOCOL_CATALOG: VieProtocolDef[] = [
  {
    slug: "baseline_consultation",
    name: "Initial / Baseline Consultation",
    description: "Six standardised scalp views for initial consultation and Patient Twin seeding.",
    imaging_library_axis: "consultation",
    slots: [
      slot(
        "front_hairline",
        "Front hairline",
        "Face the camera directly. Include the full hairline from ear to ear. Keep the device at eye level and fill the frame with the frontal scalp.",
        "front_hairline",
        "hairline"
      ),
      slot(
        "left_side",
        "Left side",
        "Turn head slightly right to expose the left temporal and parietal zone. Capture recession and fringe density with even lighting.",
        "left_side",
        "temple_left"
      ),
      slot(
        "right_side",
        "Right side",
        "Turn head slightly left to expose the right temporal and parietal zone. Match the framing used for the left side view.",
        "right_side",
        "temple_right"
      ),
      slot(
        "top",
        "Top",
        "Capture a true overhead view of the midscalp. Patient should tilt chin down; hold the device directly above the vertex.",
        "top",
        "midscalp"
      ),
      slot(
        "crown",
        "Crown",
        "Centre the crown / vertex in frame. Part the hair or use a mirror assistant; hold the device steady above the head at ~45°.",
        "crown",
        "crown"
      ),
      slot(
        "donor",
        "Donor",
        "Document the occipital donor area. Hair parted or clipped. Fill the frame with the donor strip / FUE field.",
        "donor",
        "donor"
      ),
    ],
  },
  {
    slug: "full_clinical_head_series",
    name: "Full Clinical Head Series",
    description: "Ten primary head views — wide and close-up — for comprehensive clinical documentation.",
    imaging_library_axis: "consultation",
    slots: [
      slot(
        "front",
        "Front",
        "Face the camera directly. Include the full frontal hairline and forelock at eye level.",
        "front",
        "hairline"
      ),
      slot(
        "front_close",
        "Front (close-up)",
        "Move closer to capture hairline detail, miniaturisation, and skin surface in the frontal third.",
        "front_close",
        "hairline"
      ),
      slot(
        "top",
        "Top",
        "True overhead view of the midscalp and vertex transition. Chin down; device directly above.",
        "top",
        "midscalp"
      ),
      slot(
        "top_close",
        "Top (close-up)",
        "Close overhead view of midscalp density and part-line detail.",
        "top_close",
        "midscalp"
      ),
      slot(
        "left_side",
        "Left side",
        "Expose the left temporal and parietal zone. Match lighting and distance to the right side view.",
        "left_side",
        "temple_left"
      ),
      slot(
        "left_side_close",
        "Left side (close-up)",
        "Close-up of the left temporal recession and fringe density.",
        "left_side_close",
        "temple_left"
      ),
      slot(
        "right_side",
        "Right side",
        "Expose the right temporal and parietal zone. Match the left side framing.",
        "right_side",
        "temple_right"
      ),
      slot(
        "right_side_close",
        "Right side (close-up)",
        "Close-up of the right temporal recession and fringe density.",
        "right_side_close",
        "temple_right"
      ),
      slot(
        "crown",
        "Crown",
        "Centre the crown / vertex. Part hair to show skin surface where possible.",
        "crown",
        "crown"
      ),
      slot(
        "crown_close",
        "Crown (close-up)",
        "Close-up of crown whorl, thinning pattern, and scalp visibility.",
        "crown_close",
        "crown"
      ),
    ],
  },
  {
    slug: "hair_transplant_planning",
    name: "Hair Transplant Planning",
    description: "Recipient design and donor assessment photography for surgical planning.",
    imaging_library_axis: "consultation",
    slots: [
      slot(
        "hairline_design",
        "Hairline design",
        "Capture proposed hairline markings or design template from the front at eye level.",
        "front_hairline",
        "hairline"
      ),
      slot(
        "recipient_midscalp",
        "Recipient — midscalp",
        "Document the midscalp recipient zone planned for graft placement.",
        "recipient_zone",
        "midscalp"
      ),
      slot(
        "recipient_crown",
        "Recipient — crown",
        "Capture the crown recipient area with hair parted to show skin surface.",
        "crown",
        "crown"
      ),
      slot(
        "donor",
        "Donor — overview",
        "Wide donor zone view for capacity and quality assessment. Hair parted or clipped.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "donor_close",
        "Donor — close-up",
        "Close-up donor zone for density, follicle calibre, and scarring assessment.",
        "donor_close",
        "donor",
        { slot_tier: "addon" }
      ),
    ],
  },
  {
    slug: "surgery_day",
    name: "Surgery Day",
    description: "Pre-op, intra-operative, graft documentation, and immediate post-op capture.",
    imaging_library_axis: "surgery",
    slots: [
      ...preOpHeadSeries(),
      slot(
        "pre_op_donor",
        "Pre-op — donor",
        "Document the donor area before extraction with hair clipped and landmarks visible.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "pre_op_donor_close",
        "Pre-op — donor (close-up)",
        "Close-up pre-op donor view for punch spacing and follicle calibre reference.",
        "donor_close",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "hairline_design",
        "Hairline design",
        "Capture final hairline design and surgical markings before site creation.",
        "front_hairline",
        "hairline"
      ),
      slot(
        "donor_before_extraction",
        "Donor — before extraction",
        "Donor field immediately before extraction begins.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "donor_during_extraction",
        "Donor — during extraction",
        "Donor field during active extraction showing punch sites or strip progress.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "donor_final_extraction",
        "Donor — final extraction",
        "Completed donor harvest field before dressing or closure.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "graft_tray_overview",
        "Graft tray — overview",
        "Full graft tray or petri dishes showing graft count organisation and grouping.",
        "graft_tray",
        "graft_tray"
      ),
      slot(
        "graft_tray_close",
        "Graft tray — close-up",
        "Close-up of grafts showing follicle units, bulb integrity, and transection check.",
        "graft_tray",
        "graft_tray"
      ),
      slot(
        "recipient_sites",
        "Recipient sites",
        "Document recipient site creation or graft placement in progress.",
        "recipient_zone",
        "frontal_third"
      ),
      slot(
        "immediate_post_op_front",
        "Immediate post-op — front",
        "Frontal view immediately after procedure showing graft placement and hairline.",
        "healing_progress",
        "hairline"
      ),
      slot(
        "immediate_post_op_donor",
        "Immediate post-op — donor",
        "Donor area immediately after procedure showing harvest sites or closure.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "immediate_post_op_close",
        "Immediate post-op — close-up",
        "Close-up of a representative recipient zone showing graft crusting and placement density.",
        "front_close",
        "frontal_third"
      ),
    ],
  },
  {
    slug: "post_op_review",
    name: "Post-op Review",
    description: "Immediate post-operative healing and graft survival documentation.",
    imaging_library_axis: "surgery",
    slots: [
      slot(
        "postop_front",
        "Post-op — front",
        "Frontal view showing graft crusting, erythema, and hairline position post-procedure.",
        "healing_progress",
        "hairline"
      ),
      slot(
        "postop_crown",
        "Post-op — crown",
        "Crown recipient zone healing status within 24–72 hours post-op.",
        "healing_progress",
        "crown"
      ),
      slot(
        "postop_donor",
        "Post-op — donor",
        "Donor healing, punch sites, or strip closure documentation.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
    ],
  },
  {
    slug: "follow_up_review",
    name: "Follow-up Review",
    description: "Standardised interval outcome capture for longitudinal tracking.",
    imaging_library_axis: "follow_up",
    slots: [
      slot(
        "fu_front",
        "Follow-up — front",
        "Match baseline front hairline framing for comparison.",
        "front_hairline",
        "hairline"
      ),
      slot(
        "fu_top",
        "Follow-up — top / vertex",
        "Overhead view matching baseline top angle.",
        "top",
        "crown"
      ),
      slot(
        "fu_donor",
        "Follow-up — donor",
        "Donor healing and scar maturation at follow-up interval.",
        "donor",
        "donor",
        { required: false, slot_tier: "optional" }
      ),
    ],
  },
  {
    slug: "repair_surgery_review",
    name: "Repair Surgery Review",
    description: "Documentation for corrective / repair procedures and outcome assessment.",
    imaging_library_axis: "surgery",
    slots: [
      slot(
        "repair_problem_zone",
        "Problem zone",
        "Capture the area requiring repair — unnatural hairline, pitting, or low density.",
        "repair_zone",
        "hairline"
      ),
      slot(
        "repair_donor_status",
        "Donor status",
        "Document remaining donor capacity and prior harvest scarring.",
        "donor",
        "donor",
        { slot_tier: "addon" }
      ),
      slot(
        "repair_plan_view",
        "Repair plan view",
        "Capture proposed repair zone with markings or annotated reference.",
        "recipient_zone",
        "frontal_third"
      ),
    ],
  },
];

export function isVieProtocolSlug(slug: string): slug is VieProtocolSlug {
  return (VIE_PROTOCOL_SLUGS as readonly string[]).includes(slug.trim());
}

export function getVieProtocol(slug: string): VieProtocolDef | null {
  const s = slug.trim();
  return VIE_PROTOCOL_CATALOG.find((p) => p.slug === s) ?? null;
}

export function getVieProtocolOrThrow(slug: string): VieProtocolDef {
  const p = getVieProtocol(slug);
  if (!p) throw new Error(`Unknown VIE protocol: ${slug}`);
  return p;
}

export function countRequiredProtocolSlots(protocol: VieProtocolDef): number {
  return protocol.slots.filter((s) => s.required).length;
}

export function isDonorDocumentationSlot(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  return (
    s === "donor" ||
    s === "donor_close" ||
    s.startsWith("pre_op_donor") ||
    s.startsWith("donor_") ||
    s.startsWith("immediate_post_op_donor") ||
    s === "postop_donor" ||
    s === "repair_donor_status" ||
    s === "fu_donor"
  );
}

export function vieProtocolCatalogForDbSeed(): Array<{
  slug: string;
  name: string;
  description: string;
  slots: { slots: Array<Record<string, unknown>> };
}> {
  return VIE_PROTOCOL_CATALOG.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    slots: {
      slots: p.slots.map((s) => ({
        slug: s.slug,
        label: s.label,
        required: s.required,
        slot_tier: s.slot_tier,
        suggested_region: s.suggested_region,
        instruction: s.instruction,
        capture_guide: s.capture_guide,
      })),
    },
  }));
}
