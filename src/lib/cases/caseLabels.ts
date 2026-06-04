import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";

export type CasePersonDisplay = {
  label: string;
  email: string | null;
};

/**
 * Best-effort person label from `fi_persons.metadata` for case shells.
 */
export function casePersonDisplayFromMetadata(metadata: Record<string, unknown> | null | undefined): CasePersonDisplay {
  const meta = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const { name, email } = displayFromPersonMetadata(meta as Record<string, unknown>);
  return { label: name === "—" ? "Unnamed person" : name, email };
}

export function fiCaseStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return "—";
  return status.trim();
}
