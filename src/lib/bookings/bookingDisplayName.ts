import { bookingTypeLabel } from "./operatorBookingLabels";

export const UNNAMED_PATIENT_LABEL = "Unnamed patient";

const UUID_TRUNCATION_LABEL =
  /^(Patient|Lead|Person|Case)\s+[0-9a-f]{6,8}(?:…|\.\.\.)?$/i;

/** True when a label is a developer-style truncated id (must not appear on calendar cards). */
export function isUuidTruncationDisplayLabel(label: string | null | undefined): boolean {
  const t = label?.trim();
  if (!t) return false;
  return UUID_TRUNCATION_LABEL.test(t);
}

export type BookingDisplayNameContext = {
  /** Person metadata linked via patient (`fi_persons.metadata`). */
  patientPersonMeta?: Record<string, unknown> | null;
  /** Optional `fi_patients.metadata` (legacy / overrides). */
  patientMeta?: Record<string, unknown> | null;
  /** CRM lead summary line. */
  leadSummary?: string | null;
  /** Person metadata linked via lead. */
  leadPersonMeta?: Record<string, unknown> | null;
  /** Direct booking `person_id` metadata. */
  personMeta?: Record<string, unknown> | null;
  bookingTitle?: string | null;
  bookingType?: string | null;
};

function readMetaString(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = meta[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function personFullNameFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== "object") return null;
  const first = readMetaString(meta, "first_name");
  const last = readMetaString(meta, "last_name") ?? readMetaString(meta, "surname");
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

function preferredOrDisplayFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== "object") return null;
  return (
    readMetaString(meta, "preferred_name") ??
    readMetaString(meta, "display_name") ??
    readMetaString(meta, "normalised_display_name") ??
    readMetaString(meta, "patient_name")
  );
}

/** Best-effort person/patient full or display name from metadata (no uuid fallbacks). */
export function personDisplayNameFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  return personFullNameFromMetadata(meta) ?? preferredOrDisplayFromMetadata(meta);
}

export function contactFallbackFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  const phone = readMetaString(meta, "phone");
  if (phone) return phone;
  const email = readMetaString(meta, "email") ?? readMetaString(meta, "email_normalized");
  if (email) return email;
  return null;
}

function isHumanReadableLeadSummary(summary: string | null | undefined): summary is string {
  const s = summary?.trim();
  if (!s) return false;
  if (isUuidTruncationDisplayLabel(s)) return false;
  if (/^Lead\s+[0-9a-f-]{8}/i.test(s)) return false;
  return true;
}

/** Parse `"Consultation — Jane Doe"` → `"Jane Doe"`. */
export function extractPersonNameFromBookingTitle(title: string | null | undefined): string | null {
  const t = title?.trim();
  if (!t) return null;
  const dash = t.match(/^[^—–-]+[—–-]\s*(.+)$/);
  if (dash?.[1]?.trim()) {
    const name = dash[1].trim();
    if (name && !isUuidTruncationDisplayLabel(name)) return name;
  }
  return null;
}

/**
 * Human-readable calendar / drawer label for a booking anchor.
 *
 * Priority:
 * 1. Patient/person full name
 * 2. Lead/contact full name
 * 3. Preferred / display name on patient metadata
 * 4. Human-readable lead summary
 * 5. Mobile
 * 6. Email
 * 7. Name embedded in booking title
 * 8. "Unnamed patient"
 */
export function getBookingDisplayName(ctx: BookingDisplayNameContext): string {
  const patientFull =
    personFullNameFromMetadata(ctx.patientPersonMeta) ?? personFullNameFromMetadata(ctx.personMeta);
  if (patientFull) return patientFull;

  const patientMetaFull = personFullNameFromMetadata(ctx.patientMeta);
  if (patientMetaFull) return patientMetaFull;

  const leadFull = personFullNameFromMetadata(ctx.leadPersonMeta);
  if (leadFull) return leadFull;

  for (const meta of [ctx.patientPersonMeta, ctx.personMeta, ctx.patientMeta, ctx.leadPersonMeta]) {
    const preferred = preferredOrDisplayFromMetadata(meta);
    if (preferred) return preferred;
  }

  if (isHumanReadableLeadSummary(ctx.leadSummary)) {
    return ctx.leadSummary.trim();
  }

  const fromTitle = extractPersonNameFromBookingTitle(ctx.bookingTitle);
  if (fromTitle) return fromTitle;

  const metas = [ctx.patientPersonMeta, ctx.personMeta, ctx.leadPersonMeta, ctx.patientMeta].filter(
    Boolean
  ) as Record<string, unknown>[];

  for (const meta of metas) {
    const phone = readMetaString(meta, "phone");
    if (phone) return phone;
  }

  for (const meta of metas) {
    const contact = contactFallbackFromMetadata(meta);
    if (contact?.includes("@")) return contact;
  }

  return UNNAMED_PATIENT_LABEL;
}

/** Client-side optimistic label when server display hints are not yet loaded. */
export function optimisticBookingAnchorLabel(row: {
  title?: string | null;
  booking_type?: string | null;
}): string {
  const fromTitle = extractPersonNameFromBookingTitle(row.title);
  if (fromTitle) return fromTitle;
  const title = row.title?.trim();
  if (title && !isUuidTruncationDisplayLabel(title)) return title;
  const type = row.booking_type?.trim();
  if (type) return bookingTypeLabel(type);
  return "Unnamed patient";
}
