/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — canonical source drill-down links (pure).
 * Links generated only after permission checks; use canonical patient UUIDs only.
 */

import {
  pilotControlRoleHasScope,
  type PilotControlPermissionScope,
  type PilotControlRoleKey,
} from "../pilotControlContracts";
import type { PilotSourceLink } from "./pilotControlApiTypes";

export type BuildPilotSourceLinksArgs = {
  tenantId: string;
  patientId: string;
  role: PilotControlRoleKey;
};

type LinkSpec = {
  module: PilotSourceLink["module"];
  label: string;
  href: (tenantId: string, patientId: string) => string;
  permission: PilotControlPermissionScope;
};

const LINK_SPECS: readonly LinkSpec[] = [
  {
    module: "patient",
    label: "Patient record",
    href: (t, p) => `/fi-admin/${t}/patients/${p}`,
    permission: "detail_identity",
  },
  {
    module: "journey",
    label: "Patient journey",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/journey`,
    permission: "detail_journey",
  },
  {
    module: "clinical",
    label: "Clinical",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/clinical`,
    permission: "detail_clinical_summary",
  },
  {
    module: "finance",
    label: "Finance",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/finance`,
    permission: "detail_financial_summary",
  },
  {
    module: "documents",
    label: "Documents",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/documents`,
    permission: "detail_documents",
  },
  {
    module: "pathology",
    label: "Pathology",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/pathology`,
    permission: "detail_clinical_full",
  },
  {
    module: "images",
    label: "Images",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/images`,
    permission: "detail_imaging",
  },
  {
    module: "messages",
    label: "Messages",
    href: (t, p) => `/fi-admin/${t}/front-desk/patient-messages?patientId=${p}`,
    permission: "detail_communication",
  },
  {
    module: "appointments",
    label: "Appointments",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/appointments`,
    permission: "detail_journey",
  },
  {
    module: "technical",
    label: "Technical health",
    href: (t, p) => `/fi-admin/${t}/patients/${p}/technical`,
    permission: "detail_technical",
  },
];

/**
 * Build permission-filtered source links. Never emits cross-tenant or non-UUID patient paths.
 */
export function buildPilotSourceLinks(args: BuildPilotSourceLinksArgs): PilotSourceLink[] {
  const tenantId = args.tenantId.trim();
  const patientId = args.patientId.trim();
  if (!tenantId || !patientId) return [];
  // Reject obviously non-canonical identifiers (no external IDs).
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return [];

  const links: PilotSourceLink[] = [];
  for (const spec of LINK_SPECS) {
    if (!pilotControlRoleHasScope(args.role, spec.permission)) continue;
    // Clinical full is enough for clinical summary link when only full is granted
    if (
      spec.permission === "detail_clinical_summary" &&
      !pilotControlRoleHasScope(args.role, "detail_clinical_summary") &&
      !pilotControlRoleHasScope(args.role, "detail_clinical_full")
    ) {
      continue;
    }
    if (
      spec.permission === "detail_financial_summary" &&
      !pilotControlRoleHasScope(args.role, "detail_financial_summary") &&
      !pilotControlRoleHasScope(args.role, "detail_financial_full")
    ) {
      continue;
    }
    links.push({
      module: spec.module,
      label: spec.label,
      href: spec.href(tenantId, patientId),
      permissionRequired: spec.permission,
    });
  }
  return links;
}

/** Clinical full also unlocks clinical summary links. */
export function buildPilotSourceLinksWithAliases(args: BuildPilotSourceLinksArgs): PilotSourceLink[] {
  const tenantId = args.tenantId.trim();
  const patientId = args.patientId.trim();
  if (!tenantId || !patientId || !/^[0-9a-f-]{36}$/i.test(patientId)) return [];

  const role = args.role;
  const links = buildPilotSourceLinks(args);
  // If user has clinical_full but not clinical_summary, still allow clinical module via full.
  if (
    pilotControlRoleHasScope(role, "detail_clinical_full") &&
    !links.some((l) => l.module === "clinical")
  ) {
    links.push({
      module: "clinical",
      label: "Clinical",
      href: `/fi-admin/${tenantId}/patients/${patientId}/clinical`,
      permissionRequired: "detail_clinical_full",
    });
  }
  if (
    pilotControlRoleHasScope(role, "detail_financial_full") &&
    !links.some((l) => l.module === "finance")
  ) {
    links.push({
      module: "finance",
      label: "Finance",
      href: `/fi-admin/${tenantId}/patients/${patientId}/finance`,
      permissionRequired: "detail_financial_full",
    });
  }
  return links;
}
