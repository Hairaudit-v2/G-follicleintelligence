/**
 * ImagingOS Phase 5 — staff-facing deep links for protocol sessions, galleries, and related records.
 * Does not expose raw storage paths or internal IDs in labels.
 */

export type ImagingDeepLink = {
  label: string;
  href: string;
};

export type ImagingDeepLinkSet = {
  protocolSession: ImagingDeepLink | null;
  patientGallery: ImagingDeepLink | null;
  imagingWorkspace: ImagingDeepLink | null;
  reviewQueue: ImagingDeepLink | null;
  consultation: ImagingDeepLink | null;
  procedure: ImagingDeepLink | null;
  hairAuditCase: ImagingDeepLink | null;
};

export type ImagingDeepLinkInput = {
  tenantId: string;
  patientId: string;
  protocolSessionId?: string | null;
  protocolTemplateSlug?: string | null;
  caseId?: string | null;
  consultationId?: string | null;
  procedureDayId?: string | null;
  hairAuditSourceCaseId?: string | null;
  imageId?: string | null;
  reviewRequired?: boolean;
};

function patientImagingBase(tenantId: string, patientId: string): string {
  return `/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}/imaging`;
}

export function buildImagingDeepLinks(input: ImagingDeepLinkInput): ImagingDeepLinkSet {
  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const imagingBase = patientImagingBase(tid, pid);

  const hasSessionId = Boolean(input.protocolSessionId?.trim());
  const sessionParams = new URLSearchParams();
  if (hasSessionId) {
    sessionParams.set("session", input.protocolSessionId!.trim());
  }
  if (input.protocolTemplateSlug?.trim()) {
    sessionParams.set("protocol", input.protocolTemplateSlug.trim());
  }
  const sessionQuery = sessionParams.toString();
  const sessionHref = sessionQuery ? `${imagingBase}?${sessionQuery}` : null;
  const sessionLabel = hasSessionId ? "Protocol session" : "Protocol capture";

  const galleryParams = new URLSearchParams();
  if (input.imageId?.trim()) galleryParams.set("image", input.imageId.trim());
  const galleryQuery = galleryParams.toString();

  return {
    imagingWorkspace: { label: "Imaging workspace", href: imagingBase },
    patientGallery: {
      label: "Patient gallery",
      href: galleryQuery ? `${imagingBase}?${galleryQuery}` : imagingBase,
    },
    protocolSession: sessionHref ? { label: sessionLabel, href: sessionHref } : null,
    reviewQueue: input.reviewRequired
      ? { label: "Review queue", href: `/fi-admin/${tid}/imaging/review` }
      : null,
    consultation: input.consultationId?.trim()
      ? {
          label: "Consultation",
          href: `/fi-admin/${tid}/consultations/${input.consultationId.trim()}/forms`,
        }
      : null,
    procedure:
      input.procedureDayId?.trim() || input.caseId?.trim()
        ? {
            label: "Surgery day",
            href: input.procedureDayId?.trim()
              ? `/fi-admin/${tid}/surgery-os?procedureDay=${input.procedureDayId.trim()}`
              : `/fi-admin/${tid}/surgery-os?case=${input.caseId!.trim()}`,
          }
        : null,
    hairAuditCase: input.hairAuditSourceCaseId?.trim()
      ? { label: "HairAudit case", href: "/hair-audit/admin" }
      : null,
  };
}

/** Flat list of available links for compact UI rendering. */
export function listAvailableImagingDeepLinks(links: ImagingDeepLinkSet): ImagingDeepLink[] {
  const out: ImagingDeepLink[] = [];
  for (const key of [
    "protocolSession",
    "patientGallery",
    "imagingWorkspace",
    "reviewQueue",
    "consultation",
    "procedure",
    "hairAuditCase",
  ] as const) {
    const link = links[key];
    if (link) out.push(link);
  }
  return out;
}