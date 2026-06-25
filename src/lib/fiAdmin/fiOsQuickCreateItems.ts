/**
 * FI OS global Quick Create — pure definitions for command palette (navigation only; no writes here).
 */

export type FiOsQuickCreateItemDefinition = {
  id: string;
  label: string;
  description: string;
  /** Extra strings for palette search. */
  keywords: string[];
  /** Path after tenant base `/fi-admin/[tenantId]/` (no leading slash). */
  path: string;
  /** Optional hash (without `#`) appended after path. */
  hash?: string;
  requiresCrmShellNav?: boolean;
  requiresBookingsBoardNav?: boolean;
};

export const FI_OS_QUICK_CREATE_ITEMS: FiOsQuickCreateItemDefinition[] = [
  {
    id: "consultation",
    label: "New consultation",
    description: "Start a structured consultation workspace.",
    keywords: ["consult", "booking", "visit"],
    path: "consultations/new",
  },
  {
    id: "patient",
    label: "New patient",
    description: "Add a patient via PatientOS entry paths.",
    keywords: ["patientos", "profile", "register"],
    path: "patients/new",
    requiresBookingsBoardNav: true,
  },
  {
    id: "lead",
    label: "New enquiry",
    description: "Capture a patient enquiry (name, contact, interest).",
    keywords: ["crm", "enquiry", "pipeline", "leadflow"],
    path: "crm",
    requiresCrmShellNav: true,
  },
  {
    id: "case",
    label: "New case",
    description: "Open the surgery case wizard (SurgeryOS).",
    keywords: ["surgery", "procedure", "surgeryos"],
    path: "cases/new",
  },
  {
    id: "task",
    label: "New task",
    description: "Open LeadFlow — open a lead, then add a task on the Timeline tab.",
    keywords: ["todo", "follow-up", "crm", "leadflow"],
    path: "crm",
    requiresCrmShellNav: true,
  },
  {
    id: "patient_photos",
    label: "Upload patient photos",
    description: "FoundationOS media health — then use PatientOS / appointments for uploads where enabled.",
    keywords: ["media", "gallery", "images", "foundation"],
    path: "foundation-integrity",
    hash: "fi-os-foundation-media",
  },
  {
    id: "clinical_note",
    label: "Add clinical note",
    description: "Open Appointments — pick a visit, then use Clinical notes or Timeline.",
    keywords: ["appointment", "notes", "chart", "soap"],
    path: "appointments",
    requiresBookingsBoardNav: true,
  },
];

export type ResolvedFiOsQuickCreateItem = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  href: string;
  enabled: boolean;
  disabledReason?: string;
};

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "") || "";
}

export function resolveFiOsQuickCreateItems(
  base: string,
  showCrmNav: boolean,
  showBookingsBoard: boolean
): ResolvedFiOsQuickCreateItem[] {
  const b = normalizeBase(base);
  return FI_OS_QUICK_CREATE_ITEMS.map((def) => {
    const needsCrm = Boolean(def.requiresCrmShellNav);
    const needsBookings = Boolean(def.requiresBookingsBoardNav);
    const path = def.path.trim().replace(/^\/+/, "");
    const tail = path ? `/${path}` : "";
    const hash = def.hash?.trim() ? `#${def.hash.trim()}` : "";
    const href = `${b}${tail}${hash}`;

    if (needsCrm && !showCrmNav) {
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        keywords: def.keywords,
        href: "#",
        enabled: false,
        disabledReason: "CRM / LeadFlow access required.",
      };
    }
    if (needsBookings && !showBookingsBoard) {
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        keywords: def.keywords,
        href: "#",
        enabled: false,
        disabledReason: "Scheduling / PatientOS access required.",
      };
    }
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      keywords: def.keywords,
      href,
      enabled: true,
    };
  });
}
