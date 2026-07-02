import type { WorkspaceRef } from "./types";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Infer a D1 workspace ref from a tenant-scoped FI OS href.
 * Returns null when the href should remain a full route navigation.
 */
export function inferWorkspaceFromHref(href: string): WorkspaceRef | null {
  const path = href.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!path) return null;

  const patient = path.match(new RegExp(`/fi-admin/[^/]+/patients/(${UUID})$`, "i"));
  if (patient?.[1]) return { kind: "patient", id: patient[1] };

  const lead = path.match(new RegExp(`/fi-admin/[^/]+/crm/leads/(${UUID})$`, "i"));
  if (lead?.[1]) return { kind: "lead", id: lead[1] };

  const appointment = path.match(new RegExp(`/fi-admin/[^/]+/appointments/(${UUID})$`, "i"));
  if (appointment?.[1]) return { kind: "appointment", id: appointment[1] };

  return null;
}
