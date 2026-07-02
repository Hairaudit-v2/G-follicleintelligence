import type { WorkspaceRef } from "./types";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

function matchUuid(path: string, pattern: RegExp): string | null {
  const m = path.match(pattern);
  return m?.[1] ?? null;
}

/**
 * Infer a workspace ref from a tenant-scoped FI OS href.
 * Returns null when the href should remain a full route navigation.
 */
export function inferWorkspaceFromHref(href: string): WorkspaceRef | null {
  const path = href.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!path) return null;

  const patient = matchUuid(path, new RegExp(`/fi-admin/[^/]+/patients/(${UUID})$`, "i"));
  if (patient) return { kind: "patient", id: patient };

  const lead = matchUuid(path, new RegExp(`/fi-admin/[^/]+/crm/leads/(${UUID})$`, "i"));
  if (lead) return { kind: "lead", id: lead };

  const appointment = matchUuid(path, new RegExp(`/fi-admin/[^/]+/appointments/(${UUID})$`, "i"));
  if (appointment) return { kind: "appointment", id: appointment };

  const pathologyResult = matchUuid(
    path,
    new RegExp(`/fi-admin/[^/]+/patients/${UUID}/blood-results/(${UUID})$`, "i")
  );
  if (pathologyResult) return { kind: "pathology_result", id: pathologyResult };

  const surgeryCase =
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/cases/(${UUID})(?:/summary)?$`, "i")) ??
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/surgery/cases/(${UUID})$`, "i"));
  if (surgeryCase) return { kind: "surgery_case", id: surgeryCase };

  const consultation = matchUuid(
    path,
    new RegExp(`/fi-admin/[^/]+/consultations/(${UUID})$`, "i")
  );
  if (consultation) return { kind: "consultation", id: consultation };

  const payment =
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/financial/payments/(${UUID})$`, "i")) ??
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/financial/payment-requests/(${UUID})$`, "i")) ??
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/payments/(${UUID})$`, "i"));
  if (payment) return { kind: "payment", id: payment };

  const staff =
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/workforce-os/staff/(${UUID})$`, "i")) ??
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/staff/(${UUID})(?:/twin)?$`, "i")) ??
    matchUuid(path, new RegExp(`/fi-admin/[^/]+/team/(${UUID})$`, "i"));
  if (staff) return { kind: "staff", id: staff };

  return null;
}
