import type { ProtocolSlotDef } from "@/src/lib/imagingOs/imagingOsProtocol";
import { protocolRequiredCompletionPercent, slotIsSatisfied } from "@/src/lib/imagingOs/imagingOsProtocol";

import { getVieProtocol, isDonorDocumentationSlot } from "./vieProtocolCatalog";
import type {
  VieImagingDomainCompleteness,
  ViePatientImagingCompleteness,
  VieProtocolCompleteness,
  VieSurgeryPhaseCompleteness,
} from "./vieProtocolTypes";
import { VIE_SURGERY_PHASE_GROUPS } from "./vieProtocolTypes";

export function formatVieCompletenessHeadline(completeness: ViePatientImagingCompleteness): string {
  const h = completeness.headline;
  return `${h.required_complete}/${h.required_total} ${h.protocol_name.toLowerCase()} images complete`;
}

export function formatDomainCompletenessDisplay(label: string, complete: number, total: number): string {
  return `${complete}/${total} ${label.toLowerCase()}`;
}

function buildDomainCompleteness(
  label: string,
  slots: ProtocolSlotDef[],
  progress: Record<string, unknown>
): VieImagingDomainCompleteness {
  const required = slots.filter((s) => s.required !== false);
  const requiredComplete = required.filter((s) => slotIsSatisfied(s, progress)).length;
  const percent = protocolRequiredCompletionPercent(slots, progress);
  return {
    label,
    required_total: required.length,
    required_complete: requiredComplete,
    percent,
    complete: percent >= 100,
    display: formatDomainCompletenessDisplay(label, requiredComplete, required.length),
  };
}

function mergeDomainCompleteness(
  label: string,
  parts: VieImagingDomainCompleteness[]
): VieImagingDomainCompleteness {
  const required_total = parts.reduce((n, p) => n + p.required_total, 0);
  const required_complete = parts.reduce((n, p) => n + p.required_complete, 0);
  const percent = required_total === 0 ? 100 : Math.round((required_complete / required_total) * 100);
  return {
    label,
    required_total,
    required_complete,
    percent,
    complete: percent >= 100,
    display: formatDomainCompletenessDisplay(label, required_complete, required_total),
  };
}

type SessionProgress = { template_slug: string; progress: Record<string, unknown> };

function sessionForProtocol(sessions: SessionProgress[], slug: string): SessionProgress | null {
  return sessions.find((s) => s.template_slug === slug) ?? null;
}

function catalogSlotsForProtocol(slug: string): ProtocolSlotDef[] {
  const protocol = getVieProtocol(slug);
  if (!protocol) return [];
  return protocol.slots.map((s) => ({
    slug: s.slug,
    label: s.label,
    required: s.required,
    suggested_region: s.suggested_region,
    instruction: s.instruction,
  }));
}

/** Consultation completeness — initial / baseline consultation (6 required views). */
export function computeConsultationCompleteness(sessions: SessionProgress[]): VieImagingDomainCompleteness {
  const baseline = sessionForProtocol(sessions, "baseline_consultation");
  const slots = catalogSlotsForProtocol("baseline_consultation");
  return buildDomainCompleteness("Consultation", slots, baseline?.progress ?? {});
}

/** Full clinical head series completeness — 10 required wide + close-up views. */
export function computeFullHeadSeriesCompleteness(sessions: SessionProgress[]): VieImagingDomainCompleteness {
  const clinical = sessionForProtocol(sessions, "full_clinical_head_series");
  const slots = catalogSlotsForProtocol("full_clinical_head_series");
  return buildDomainCompleteness("Full head series", slots, clinical?.progress ?? {});
}

/** Surgical documentation completeness — surgery day operative capture. */
export function computeSurgicalDocumentationCompleteness(sessions: SessionProgress[]): VieImagingDomainCompleteness {
  const surgery = sessionForProtocol(sessions, "surgery_day");
  const slots = catalogSlotsForProtocol("surgery_day");
  return buildDomainCompleteness("Surgical documentation", slots, surgery?.progress ?? {});
}

/** Per-phase completeness for surgery day operative documentation. */
export function computeSurgeryPhaseCompleteness(sessions: SessionProgress[]): VieSurgeryPhaseCompleteness[] {
  const protocol = getVieProtocol("surgery_day");
  if (!protocol) return [];

  const surgery = sessionForProtocol(sessions, "surgery_day");
  const progress = surgery?.progress ?? {};

  return VIE_SURGERY_PHASE_GROUPS.map(({ phase, label }) => {
    const phaseSlots = protocol.slots.filter((s) => s.surgery_phase === phase && s.required);
    const requiredComplete = phaseSlots.filter((s) =>
      slotIsSatisfied(
        {
          slug: s.slug,
          label: s.label,
          required: s.required,
        },
        progress
      )
    ).length;
    const required_total = phaseSlots.length;
    const percent = required_total === 0 ? 100 : Math.round((requiredComplete / required_total) * 100);
    return {
      phase,
      label,
      required_total,
      required_complete: requiredComplete,
      percent,
      complete: percent >= 100,
      display: formatDomainCompletenessDisplay(label, requiredComplete, required_total),
    };
  }).filter((g) => g.required_total > 0);
}

/** Donor documentation — required add-on donor slots across planning and surgical protocols. */
export function computeDonorDocumentationCompleteness(sessions: SessionProgress[]): VieImagingDomainCompleteness {
  const donorProtocolSlugs = ["hair_transplant_planning", "surgery_day", "post_op_review", "repair_surgery_review"];
  const parts: VieImagingDomainCompleteness[] = [];

  for (const slug of donorProtocolSlugs) {
    const protocol = getVieProtocol(slug);
    if (!protocol) continue;
    const donorSlots = protocol.slots.filter(
      (s) => s.required && (s.slot_tier === "addon" || isDonorDocumentationSlot(s.slug))
    );
    if (donorSlots.length === 0) continue;
    const session = sessionForProtocol(sessions, slug);
    parts.push(
      buildDomainCompleteness(
        slug,
        donorSlots.map((s) => ({
          slug: s.slug,
          label: s.label,
          required: s.required,
          suggested_region: s.suggested_region,
          instruction: s.instruction,
        })),
        session?.progress ?? {}
      )
    );
  }

  if (parts.length === 0) {
    return {
      label: "Donor documentation",
      required_total: 0,
      required_complete: 0,
      percent: 100,
      complete: true,
      display: "0/0 donor documentation",
    };
  }

  return mergeDomainCompleteness("Donor documentation", parts);
}

export function enrichPatientImagingCompleteness(
  base: Omit<
    ViePatientImagingCompleteness,
    "consultation" | "full_head_series" | "surgical_documentation" | "donor_documentation" | "surgery_phase_groups"
  >,
  sessions: SessionProgress[]
): ViePatientImagingCompleteness {
  return {
    ...base,
    consultation: computeConsultationCompleteness(sessions),
    full_head_series: computeFullHeadSeriesCompleteness(sessions),
    surgical_documentation: computeSurgicalDocumentationCompleteness(sessions),
    donor_documentation: computeDonorDocumentationCompleteness(sessions),
    surgery_phase_groups: computeSurgeryPhaseCompleteness(sessions),
  };
}

export function protocolCompletenessFromProgress(
  protocolSlug: string,
  protocolName: string,
  slots: ProtocolSlotDef[],
  progress: Record<string, unknown>
): VieProtocolCompleteness {
  const required = slots.filter((s) => s.required !== false);
  const optional = slots.filter((s) => s.required === false);
  const requiredComplete = required.filter((s) => slotIsSatisfied(s, progress)).length;
  const optionalComplete = optional.filter((s) => slotIsSatisfied(s, progress)).length;
  const percent = protocolRequiredCompletionPercent(slots, progress);

  return {
    protocol_slug: protocolSlug as VieProtocolCompleteness["protocol_slug"],
    protocol_name: protocolName,
    required_total: required.length,
    required_complete: requiredComplete,
    optional_total: optional.length,
    optional_complete: optionalComplete,
    percent,
    complete: percent >= 100,
    display: `${requiredComplete}/${required.length} ${protocolName.toLowerCase()} images complete`,
    slots: [],
  };
}
