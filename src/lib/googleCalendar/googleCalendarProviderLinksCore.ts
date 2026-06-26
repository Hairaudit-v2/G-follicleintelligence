/**
 * CalendarOS Phase GC-6 — staff calendar link lookup and client-safe serialization.
 * Pure helpers (no server-only) for unit tests + loader integration.
 */

export const STAFF_CALENDAR_LINK_STATUSES = ["active", "inactive"] as const;
export type StaffCalendarLinkStatus = (typeof STAFF_CALENDAR_LINK_STATUSES)[number];

export const STAFF_CALENDAR_LINK_PROVIDERS = ["google", "timely"] as const;
export type StaffCalendarLinkProvider = (typeof STAFF_CALENDAR_LINK_PROVIDERS)[number];

/** Minimal row shape for calendar event → staff assignment lookups. */
export type StaffCalendarLinkLookupRow = {
  id: string;
  tenant_id: string;
  staff_member_id: string;
  provider: string;
  calendar_id: string;
  status: string;
};

export type CalendarEventStaffAssignment = {
  staffMemberId: string | null;
  linkId: string | null;
};

export type StaffCalendarLinkClientRow = {
  id: string;
  staffMemberId: string;
  staffMemberName: string;
  provider: string;
  calendarId: string;
  calendarLabel: string | null;
  googleAccountEmail: string | null;
  sourceSystem: string;
  status: StaffCalendarLinkStatus;
  timelyIcsConfigured: boolean;
  timelyIcsMasked: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffCalendarLinkPageModel = {
  tenantId: string;
  links: StaffCalendarLinkClientRow[];
  staffOptions: { id: string; fullName: string }[];
  canManage: boolean;
};

export type CreateStaffCalendarLinkInput = {
  tenantId: string;
  staffMemberId: string;
  calendarId: string;
  provider?: StaffCalendarLinkProvider;
  calendarLabel?: string | null;
  googleAccountEmail?: string | null;
  timelyIcsUrl?: string | null;
  sourceSystem?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateStaffCalendarLinkInput = {
  tenantId: string;
  linkId: string;
  staffMemberId?: string;
  calendarLabel?: string | null;
  googleAccountEmail?: string | null;
  timelyIcsUrl?: string | null;
  status?: "active" | "inactive";
  metadata?: Record<string, unknown>;
};

const ICS_URL_KEY_PATTERN = /ics|timely.*url|feed.*url/i;

/** Stable lookup key: provider + calendar_id (tenant scope applied separately). */
export function staffCalendarLinkLookupKey(provider: string, calendarId: string): string {
  return `${provider.trim().toLowerCase()}:${calendarId.trim()}`;
}

export function buildStaffCalendarLinkIndex(
  links: StaffCalendarLinkLookupRow[],
  tenantId: string
): Map<string, StaffCalendarLinkLookupRow> {
  const tid = tenantId.trim();
  const index = new Map<string, StaffCalendarLinkLookupRow>();
  for (const link of links) {
    if (link.tenant_id.trim() !== tid) continue;
    if (link.status.trim().toLowerCase() !== "active") continue;
    const key = staffCalendarLinkLookupKey(link.provider, link.calendar_id);
    index.set(key, link);
  }
  return index;
}

/** Match fi_calendar_events.calendar_id (+ provider) to an active staff link. */
export function findStaffForCalendarEvent(
  event: { tenant_id: string; provider: string; calendar_id: string },
  links: StaffCalendarLinkLookupRow[] | Map<string, StaffCalendarLinkLookupRow>,
  tenantId?: string
): string | null {
  const tid = (tenantId ?? event.tenant_id).trim();
  if (event.tenant_id.trim() !== tid) return null;

  const key = staffCalendarLinkLookupKey(event.provider, event.calendar_id);
  if (links instanceof Map) {
    const match = links.get(key);
    if (!match || match.tenant_id.trim() !== tid || match.status.trim().toLowerCase() !== "active") {
      return null;
    }
    return match.staff_member_id.trim() || null;
  }

  for (const link of links) {
    if (link.tenant_id.trim() !== tid) continue;
    if (link.status.trim().toLowerCase() !== "active") continue;
    if (staffCalendarLinkLookupKey(link.provider, link.calendar_id) === key) {
      return link.staff_member_id.trim() || null;
    }
  }
  return null;
}

export function resolveCalendarEventStaffAssignment(
  event: { tenant_id: string; provider: string; calendar_id: string },
  links: StaffCalendarLinkLookupRow[] | Map<string, StaffCalendarLinkLookupRow>,
  tenantId?: string
): CalendarEventStaffAssignment {
  const tid = (tenantId ?? event.tenant_id).trim();
  const key = staffCalendarLinkLookupKey(event.provider, event.calendar_id);

  if (links instanceof Map) {
    const match = links.get(key);
    if (!match || match.tenant_id.trim() !== tid || match.status.trim().toLowerCase() !== "active") {
      return { staffMemberId: null, linkId: null };
    }
    return { staffMemberId: match.staff_member_id.trim() || null, linkId: match.id };
  }

  for (const link of links) {
    if (link.tenant_id.trim() !== tid) continue;
    if (link.status.trim().toLowerCase() !== "active") continue;
    if (staffCalendarLinkLookupKey(link.provider, link.calendar_id) === key) {
      return { staffMemberId: link.staff_member_id.trim() || null, linkId: link.id };
    }
  }
  return { staffMemberId: null, linkId: null };
}

/** Mask a Timely ICS URL for admin display — never show the raw URL. */
export function maskTimelyIcsUrlForDisplay(icsUrl: string | null | undefined): string | null {
  const raw = icsUrl?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const tail = pathParts.length > 0 ? pathParts[pathParts.length - 1]! : "";
    const maskedTail = tail.length > 4 ? `${tail.slice(0, 2)}••••${tail.slice(-2)}` : "••••";
    return `${host}/…/${maskedTail}`;
  } catch {
    const len = raw.length;
    if (len <= 8) return "••••••••";
    return `${raw.slice(0, 4)}••••${raw.slice(-4)}`;
  }
}

export function maskStoredTimelyIcsForDisplay(hasEncryptedValue: boolean): string | null {
  return hasEncryptedValue ? "•••••••• (Timely ICS stored — treat like a password)" : null;
}

type StaffCalendarLinkRowForClient = {
  id: string;
  staff_member_id: string;
  provider: string;
  calendar_id: string;
  calendar_label: string | null;
  google_account_email: string | null;
  timely_ics_url_encrypted: string | null;
  source_system: string;
  status: string;
  created_at: string;
  updated_at: string;
};

/** Serialize a link row for admin UI — strips encrypted ICS and any secret fields. */
export function staffCalendarLinkToClientRow(
  row: StaffCalendarLinkRowForClient,
  staffMemberName: string
): StaffCalendarLinkClientRow {
  const hasIcs = Boolean(row.timely_ics_url_encrypted?.trim());
  return {
    id: row.id,
    staffMemberId: row.staff_member_id,
    staffMemberName: staffMemberName.trim() || "Staff",
    provider: row.provider,
    calendarId: row.calendar_id,
    calendarLabel: row.calendar_label?.trim() || null,
    googleAccountEmail: row.google_account_email?.trim() || null,
    sourceSystem: row.source_system,
    status: row.status.trim().toLowerCase() === "inactive" ? "inactive" : "active",
    timelyIcsConfigured: hasIcs,
    timelyIcsMasked: maskStoredTimelyIcsForDisplay(hasIcs),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Returns true when a serialized client payload exposes raw ICS URLs or encrypted blobs. */
export function staffCalendarLinkClientPayloadExposesSecrets(payload: unknown): boolean {
  if (payload == null || typeof payload !== "object") return false;
  const serialized = JSON.stringify(payload);
  if (/timely_ics_url_encrypted/i.test(serialized)) return true;
  if (/https?:\/\/[^\s"]*\.ics/i.test(serialized)) return true;
  if (/timely\.com\/calendar\/feed/i.test(serialized)) return true;
  return false;
}

/** Strip ICS URL fields from arbitrary objects before client serialization. */
export function sanitizeStaffCalendarLinkPayloadForClient<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (ICS_URL_KEY_PATTERN.test(key) || key === "timely_ics_url_encrypted") {
      delete out[key];
    }
  }
  return out;
}
