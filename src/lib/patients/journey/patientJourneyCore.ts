/**
 * Pure builders for Patient Visual Journey (no server-only deps).
 */

import type {
  PatientJourneyMilestone,
  PatientJourneyMilestoneKind,
  PatientJourneyPhotoItem,
  PatientJourneyPhotoLabel,
  PatientJourneyQuickAction,
  PatientJourneyScaleKind,
  PatientJourneyScalePoint,
  PatientJourneyScaleSeries,
  PatientJourneyView,
} from "./patientJourneyTypes";
import { PATIENT_JOURNEY_DISCLAIMER } from "./patientJourneyTypes";

export function mapImageCategoryToJourneyLabel(
  category: string | null | undefined
): { label: PatientJourneyPhotoLabel; display: string } {
  const c = String(category ?? "other").toLowerCase();
  if (c === "before" || c.includes("baseline")) {
    return { label: "baseline", display: "Baseline" };
  }
  if (c === "progress" || c.includes("progress")) {
    return { label: "progress", display: "Progress" };
  }
  if (c === "post_op" || c === "after" || c.includes("post")) {
    return { label: "post_op", display: "Post-op" };
  }
  if (c === "consult") return { label: "consult", display: "Consult" };
  if (c === "donor") return { label: "donor", display: "Donor" };
  if (c === "hairline") return { label: "hairline", display: "Hairline" };
  return { label: "other", display: c.replace(/_/g, " ") || "Photo" };
}

export function buildJourneyPhotos(input: {
  tenantId: string;
  patientId: string;
  images: readonly {
    id: string;
    image_category: string;
    caption: string | null;
    taken_at: string | null;
    created_at: string;
    thumbUrl?: string | null;
  }[];
  max?: number;
}): PatientJourneyPhotoItem[] {
  const max = Math.min(Math.max(input.max ?? 24, 1), 48);
  const base = `/fi-admin/${input.tenantId.trim()}/patients/${input.patientId.trim()}`;
  return input.images.slice(0, max).map((img) => {
    const { label, display } = mapImageCategoryToJourneyLabel(img.image_category);
    return {
      id: img.id,
      takenAtIso: img.taken_at,
      createdAtIso: img.created_at,
      label,
      labelDisplay: display,
      categoryRaw: img.image_category,
      caption: img.caption,
      thumbUrl: img.thumbUrl ?? null,
      href: `${base}/imaging`,
    };
  });
}

function kindLabel(kind: PatientJourneyScaleKind): string {
  switch (kind) {
    case "norwood":
      return "Norwood (SGFHC-style stage field)";
    case "ludwig":
      return "Ludwig";
    case "sgfhc":
      return "SGFHC";
    case "green":
      return "Green";
    case "adfhl":
      return "ADFHL";
    case "hairline":
      return "Hairline pattern";
    default:
      return "Scale field";
  }
}

/** Ordinal for simple trend arrows (display only — not clinical). */
const NORWOOD_ORDER = [
  "I",
  "II",
  "IIa",
  "III",
  "IIIa",
  "IIIvertex",
  "IV",
  "IVa",
  "V",
  "Va",
  "VI",
  "VII",
];

function ordinalForScale(kind: PatientJourneyScaleKind, value: string): number | null {
  const v = value.trim();
  if (kind === "norwood") {
    const i = NORWOOD_ORDER.indexOf(v);
    return i >= 0 ? i : null;
  }
  if (kind === "ludwig") {
    if (v === "I") return 1;
    if (v === "II") return 2;
    if (v === "III") return 3;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function computeScaleTrend(
  points: readonly PatientJourneyScalePoint[]
): PatientJourneyScaleSeries["trend"] {
  if (points.length === 0) return "unknown";
  if (points.length === 1) return "single";
  const a = ordinalForScale(points[0]!.kind, points[0]!.value);
  const b = ordinalForScale(points[points.length - 1]!.kind, points[points.length - 1]!.value);
  if (a == null || b == null) return "unknown";
  if (b > a) return "up";
  if (b < a) return "down";
  return "stable";
}

function trendLabel(t: PatientJourneyScaleSeries["trend"]): string {
  switch (t) {
    case "up":
      return "Higher stage recorded later (field change only)";
    case "down":
      return "Lower stage recorded later (field change only)";
    case "stable":
      return "Same value across records";
    case "single":
      return "Single recorded value";
    default:
      return "Trend not computed";
  }
}

/**
 * Build scale series from clinical details + optional metadata history.
 * Never invents clinical meaning — shows values as recorded.
 */
export function buildJourneyScaleSeries(input: {
  norwood_scale?: string | null;
  ludwig_scale?: string | null;
  hairline_pattern?: string | null;
  metadata?: Record<string, unknown> | null;
  updatedAtIso?: string | null;
}): PatientJourneyScaleSeries[] {
  const meta = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const series: PatientJourneyScaleSeries[] = [];

  const pushCurrent = (
    kind: PatientJourneyScaleKind,
    value: string | null | undefined,
    at: string | null
  ) => {
    if (!value?.trim() || value === "unknown") return;
    const historyKey = `${kind}_history`;
    const histRaw = meta[historyKey];
    const points: PatientJourneyScalePoint[] = [];
    if (Array.isArray(histRaw)) {
      for (const row of histRaw.slice(0, 12)) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const v = r.value != null ? String(r.value).trim() : "";
        if (!v) continue;
        points.push({
          kind,
          kindLabel: kindLabel(kind),
          value: v,
          recordedAtIso: r.at != null ? String(r.at) : null,
          source: "metadata_history",
        });
      }
    }
    points.push({
      kind,
      kindLabel: kindLabel(kind),
      value: value.trim(),
      recordedAtIso: at,
      source: "clinical_details",
    });
    // de-dupe consecutive same values
    const deduped: PatientJourneyScalePoint[] = [];
    for (const p of points) {
      const last = deduped[deduped.length - 1];
      if (last && last.value === p.value && last.recordedAtIso === p.recordedAtIso) continue;
      deduped.push(p);
    }
    const trend = computeScaleTrend(deduped);
    series.push({
      kind,
      kindLabel: kindLabel(kind),
      points: deduped,
      trend,
      trendLabel: trendLabel(trend),
    });
  };

  pushCurrent("norwood", input.norwood_scale, input.updatedAtIso ?? null);
  pushCurrent("ludwig", input.ludwig_scale, input.updatedAtIso ?? null);
  pushCurrent("hairline", input.hairline_pattern, input.updatedAtIso ?? null);

  // Optional clinic form flags stored as presence only
  for (const [key, kind] of [
    ["sgfhc_value", "sgfhc"],
    ["green_scale_value", "green"],
    ["adfhl_value", "adfhl"],
  ] as const) {
    const v = meta[key];
    if (v != null && String(v).trim()) {
      pushCurrent(kind, String(v), input.updatedAtIso ?? null);
    } else if (meta[`${kind}_recorded`] === true) {
      series.push({
        kind,
        kindLabel: kindLabel(kind),
        points: [
          {
            kind,
            kindLabel: kindLabel(kind),
            value: "Recorded on form",
            recordedAtIso: input.updatedAtIso ?? null,
            source: "flag",
          },
        ],
        trend: "single",
        trendLabel: trendLabel("single"),
      });
    }
  }

  return series;
}

const MILESTONE_TYPES: Record<string, PatientJourneyMilestoneKind> = {
  booking_scheduled: "consult",
  booking_completed: "consult",
  booking_cancelled: "consult",
  case_created: "case",
  lead_created: "lead",
  lead_converted: "lead",
  image_uploaded: "imaging",
  follow_up_encounter: "follow_up",
  follow_up_photos_captured: "follow_up",
  clinical_details_updated: "consult",
  patient_admin_updated: "record",
};

export function mapTimelineItemToMilestone(item: {
  id: string;
  occurred_at: string;
  item_type: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  is_sensitive?: boolean;
}): PatientJourneyMilestone | null {
  if (item.is_sensitive) {
    return {
      id: item.id,
      kind: "other",
      kindLabel: "Recorded activity",
      title: "Activity on file (details protected)",
      subtitle: null,
      occurredAtIso: item.occurred_at,
      href: item.href,
      severity: "info",
    };
  }
  const kind = MILESTONE_TYPES[item.item_type] ?? "other";
  const kindLabel =
    kind === "consult"
      ? "Visit / consult"
      : kind === "follow_up"
        ? "Follow-up"
        : kind === "imaging"
          ? "Imaging"
          : kind === "case"
            ? "Case"
            : kind === "lead"
              ? "Enquiry"
              : kind === "procedure"
                ? "Procedure"
                : kind === "deposit"
                  ? "Deposit"
                  : "Milestone";

  let severity: PatientJourneyMilestone["severity"] = "info";
  if (item.item_type === "booking_cancelled") severity = "attention";
  if (item.item_type === "booking_completed" || item.item_type === "lead_converted") {
    severity = "success";
  }

  // Heuristic labels from title for deposits / procedures (operational wording only)
  const t = item.title.toLowerCase();
  let finalKind = kind;
  if (t.includes("deposit") || t.includes("payment")) finalKind = "deposit";
  if (t.includes("surgery") || t.includes("procedure") || t.includes("graft")) {
    finalKind = "procedure";
  }

  return {
    id: item.id,
    kind: finalKind,
    kindLabel:
      finalKind === "deposit"
        ? "Deposit / payment"
        : finalKind === "procedure"
          ? "Procedure-related"
          : kindLabel,
    title: item.title,
    subtitle: item.subtitle,
    occurredAtIso: item.occurred_at,
    href: item.href,
    severity,
  };
}

export function buildJourneyMilestones(
  items: readonly {
    id: string;
    occurred_at: string;
    item_type: string;
    title: string;
    subtitle: string | null;
    href: string | null;
    is_sensitive?: boolean;
  }[],
  max = 20
): PatientJourneyMilestone[] {
  const out: PatientJourneyMilestone[] = [];
  for (const item of items) {
    const m = mapTimelineItemToMilestone(item);
    if (m) out.push(m);
    if (out.length >= max) break;
  }
  return out;
}

export function buildJourneyQuickActions(
  tenantId: string,
  patientId: string
): PatientJourneyQuickAction[] {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const base = `/fi-admin/${tid}/patients/${pid}`;
  return [
    {
      code: "qa_imaging_patient",
      label: "Open imaging",
      description: "Upload or review photos for this patient.",
      href: `${base}/imaging`,
    },
    {
      code: "qa_ai_patient_summary",
      label: "AI Summary",
      description: "Operational overview of the record.",
      href: base,
    },
    {
      code: "qa_patient_journey",
      label: "Visual journey",
      description: "Photos, scale fields, and milestones in one place.",
      href: `${base}/timeline`,
    },
    {
      code: "qa_scale_tool",
      label: "Consultation forms",
      description: "Scale fields live on forms — operational navigation only.",
      href: `/fi-admin/${tid}/consultations`,
    },
    {
      code: "qa_schedule_followup",
      label: "Book follow-up",
      description: "Open Calendar to schedule the next visit.",
      href: `/fi-admin/${tid}/calendar`,
    },
  ];
}

export function buildPatientJourneyView(input: {
  tenantId: string;
  patientId: string;
  displayName?: string | null;
  images: readonly {
    id: string;
    image_category: string;
    caption: string | null;
    taken_at: string | null;
    created_at: string;
    thumbUrl?: string | null;
  }[];
  clinical?: {
    norwood_scale?: string | null;
    ludwig_scale?: string | null;
    hairline_pattern?: string | null;
    metadata?: Record<string, unknown> | null;
    updated_at?: string | null;
  } | null;
  timelineItems: readonly {
    id: string;
    occurred_at: string;
    item_type: string;
    title: string;
    subtitle: string | null;
    href: string | null;
    is_sensitive?: boolean;
  }[];
  upcomingBookingCount?: number;
}): PatientJourneyView {
  const photos = buildJourneyPhotos({
    tenantId: input.tenantId,
    patientId: input.patientId,
    images: input.images,
  });
  const scaleSeries = buildJourneyScaleSeries({
    norwood_scale: input.clinical?.norwood_scale,
    ludwig_scale: input.clinical?.ludwig_scale,
    hairline_pattern: input.clinical?.hairline_pattern,
    metadata: input.clinical?.metadata,
    updatedAtIso: input.clinical?.updated_at ?? null,
  });
  const milestones = buildJourneyMilestones(input.timelineItems, 24);
  const quickActions = buildJourneyQuickActions(input.tenantId, input.patientId);

  return {
    tenantId: input.tenantId.trim(),
    patientId: input.patientId.trim(),
    displayName: input.displayName ?? null,
    disclaimer: PATIENT_JOURNEY_DISCLAIMER,
    photos,
    scaleSeries,
    milestones,
    quickActions,
    stats: {
      photoCount: photos.length,
      milestoneCount: milestones.length,
      scaleKindsRecorded: scaleSeries.length,
      upcomingBookings: Math.max(0, input.upcomingBookingCount ?? 0),
    },
  };
}
