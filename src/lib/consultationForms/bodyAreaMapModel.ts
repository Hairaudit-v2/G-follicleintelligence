/**
 * Body area map / wireframe annotation value model (ConsultationOS Stage 2).
 * Coordinates are percentages 0–100 relative to the SVG viewBox.
 */

export type BodyAreaMapViewId =
  | "frontal_hairline"
  | "top_scalp"
  | "crown"
  | "donor_back"
  | "beard_face"
  | "eyebrows";

export type BodyAreaMapSeverity = "mild" | "moderate" | "severe" | "not_assessed";

export type BodyAreaMapAnnotation = {
  id: string;
  view: BodyAreaMapViewId;
  x: number;
  y: number;
  label: string;
  severity: BodyAreaMapSeverity;
  tags: string[];
  notes: string;
  createdAt: string;
};

export type BodyAreaMapValue = {
  view: BodyAreaMapViewId;
  annotations: BodyAreaMapAnnotation[];
};

export const BODY_AREA_MAP_VIEWS: readonly BodyAreaMapViewId[] = [
  "frontal_hairline",
  "top_scalp",
  "crown",
  "donor_back",
  "beard_face",
  "eyebrows",
] as const;

export const BODY_AREA_MAP_VIEW_LABELS: Record<BodyAreaMapViewId, string> = {
  frontal_hairline: "Frontal hairline",
  top_scalp: "Top scalp",
  crown: "Crown",
  donor_back: "Donor / back",
  beard_face: "Beard / face",
  eyebrows: "Eyebrows",
};

export const BODY_AREA_MAP_LABEL_OPTIONS: { value: string; label: string }[] = [
  { value: "hairline_recession", label: "Hairline recession" },
  { value: "temple_recession", label: "Temple recession" },
  { value: "frontal_thinning", label: "Frontal thinning" },
  { value: "mid_scalp_thinning", label: "Mid-scalp thinning" },
  { value: "crown_thinning", label: "Crown thinning" },
  { value: "donor_thinning", label: "Donor thinning" },
  { value: "retrograde_alopecia", label: "Retrograde alopecia" },
  { value: "dupa_concern", label: "DUPA concern" },
  { value: "scar", label: "Scar" },
  { value: "previous_transplant_issue", label: "Previous transplant issue" },
  { value: "inflammation", label: "Inflammation" },
  { value: "miniaturisation", label: "Miniaturisation" },
  { value: "density_concern", label: "Density concern" },
  { value: "asymmetry", label: "Asymmetry" },
  { value: "beard_gap", label: "Beard gap" },
  { value: "eyebrow_gap", label: "Eyebrow gap" },
];

export const BODY_AREA_MAP_SEVERITY_OPTIONS: { value: BodyAreaMapSeverity; label: string }[] = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "not_assessed", label: "Not assessed" },
];

export const BODY_AREA_MAP_TAG_OPTIONS: { value: string; label: string }[] = [
  { value: "recession", label: "Recession" },
  { value: "thinning", label: "Thinning" },
  { value: "crown", label: "Crown" },
  { value: "donor", label: "Donor" },
  { value: "scar", label: "Scar" },
  { value: "inflammation", label: "Inflammation" },
  { value: "miniaturisation", label: "Miniaturisation" },
  { value: "previous_transplant", label: "Previous transplant" },
  { value: "asymmetry", label: "Asymmetry" },
  { value: "density", label: "Density" },
  { value: "beard", label: "Beard" },
  { value: "eyebrow", label: "Eyebrow" },
];

const DEFAULT_LABEL = BODY_AREA_MAP_LABEL_OPTIONS[0]?.value ?? "hairline_recession";

function randomAnnotationId(): string {
  try {
    const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* ignore */
  }
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function isBodyAreaMapViewId(v: unknown): v is BodyAreaMapViewId {
  return typeof v === "string" && (BODY_AREA_MAP_VIEWS as readonly string[]).includes(v);
}

function isSeverity(v: unknown): v is BodyAreaMapSeverity {
  return v === "mild" || v === "moderate" || v === "severe" || v === "not_assessed";
}

function normalizeAnnotation(
  raw: unknown,
  fallbackView: BodyAreaMapViewId
): BodyAreaMapAnnotation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : randomAnnotationId();
  const view = isBodyAreaMapViewId(o.view) ? o.view : fallbackView;
  const x = clampPct(Number(o.x));
  const y = clampPct(Number(o.y));
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : DEFAULT_LABEL;
  const severity = isSeverity(o.severity) ? o.severity : "not_assessed";
  const tags = Array.isArray(o.tags) ? o.tags.map((t) => String(t)).filter(Boolean) : [];
  const notes = typeof o.notes === "string" ? o.notes : "";
  const createdAt =
    typeof o.createdAt === "string" && o.createdAt.trim()
      ? o.createdAt.trim()
      : new Date().toISOString();
  return { id, view, x, y, label, severity, tags, notes, createdAt };
}

/**
 * Normalizes arbitrary JSON into a stable {@link BodyAreaMapValue}.
 */
export function normalizeBodyAreaMapValue(
  raw: unknown,
  allowedViews: readonly BodyAreaMapViewId[] = BODY_AREA_MAP_VIEWS
): BodyAreaMapValue {
  const views = allowedViews.length > 0 ? [...allowedViews] : [...BODY_AREA_MAP_VIEWS];
  const firstAllowed = views[0] ?? "frontal_hairline";
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { view: firstAllowed, annotations: [] };
  }
  const o = raw as Record<string, unknown>;
  const view = isBodyAreaMapViewId(o.view) && views.includes(o.view) ? o.view : firstAllowed;
  const list = Array.isArray(o.annotations) ? o.annotations : [];
  const annotations: BodyAreaMapAnnotation[] = [];
  for (const item of list) {
    const ann = normalizeAnnotation(item, view);
    if (!ann) continue;
    const vw = views.includes(ann.view) ? ann.view : firstAllowed;
    annotations.push({ ...ann, view: vw });
  }
  return { view, annotations };
}

/** True if value has the minimal shape `{ annotations: array }` (annotations may be empty). */
export function isWellFormedBodyAreaMapValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  if (typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (!("annotations" in o)) return false;
  return Array.isArray(o.annotations);
}

/** True if there is at least one annotation (for future required rules). */
export function bodyAreaMapHasAnnotations(
  raw: unknown,
  allowedViews?: readonly BodyAreaMapViewId[]
): boolean {
  const n = normalizeBodyAreaMapValue(raw, allowedViews ?? BODY_AREA_MAP_VIEWS);
  return n.annotations.length > 0;
}

export function labelDisplayForBodyAreaMap(value: string): string {
  return BODY_AREA_MAP_LABEL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function viewDisplayForBodyAreaMap(view: BodyAreaMapViewId): string {
  return BODY_AREA_MAP_VIEW_LABELS[view] ?? view;
}

const SEVERITY_RANK: Record<BodyAreaMapSeverity, number> = {
  not_assessed: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

function worseSeverity(a: BodyAreaMapSeverity, b: BodyAreaMapSeverity): BodyAreaMapSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** One row per anatomical region label — merges duplicate markers (same label, same or different views). */
export type BodyAreaMapRegionAggregate = {
  labelValue: string;
  labelDisplay: string;
  views: BodyAreaMapViewId[];
  severity: BodyAreaMapSeverity;
  markerCount: number;
  combinedNotes: string;
};

export function aggregateBodyAreaMapByRegionLabel(
  annotations: readonly BodyAreaMapAnnotation[]
): BodyAreaMapRegionAggregate[] {
  type Acc = {
    views: Set<BodyAreaMapViewId>;
    severity: BodyAreaMapSeverity;
    markerCount: number;
    notes: string[];
  };
  const byLabel = new Map<string, Acc>();
  for (const a of annotations) {
    const key = a.label.trim() || DEFAULT_LABEL;
    const cur = byLabel.get(key) ?? {
      views: new Set<BodyAreaMapViewId>(),
      severity: "not_assessed",
      markerCount: 0,
      notes: [],
    };
    cur.views.add(a.view);
    cur.severity = worseSeverity(cur.severity, a.severity);
    cur.markerCount += 1;
    const n = a.notes.trim();
    if (n && !cur.notes.includes(n)) cur.notes.push(n);
    byLabel.set(key, cur);
  }
  const viewOrder = new Map(BODY_AREA_MAP_VIEWS.map((v, i) => [v, i] as const));
  const rows: BodyAreaMapRegionAggregate[] = [];
  for (const [labelValue, acc] of byLabel) {
    const views = [...acc.views].sort(
      (x, y) => (viewOrder.get(x) ?? 99) - (viewOrder.get(y) ?? 99)
    );
    rows.push({
      labelValue,
      labelDisplay: labelDisplayForBodyAreaMap(labelValue),
      views,
      severity: acc.severity,
      markerCount: acc.markerCount,
      combinedNotes: acc.notes.join("; "),
    });
  }
  rows.sort((a, b) => a.labelDisplay.localeCompare(b.labelDisplay));
  return rows;
}
