import Link from "next/link";
import { caseDetailCasesListHref } from "@/src/lib/cases/caseDetailFromCasesParam";

export function CaseDetailBackLink({
  tenantId,
  casesListReturnQuery,
}: {
  tenantId: string;
  /** Sanitized cases index query string (no leading `?`). */
  casesListReturnQuery?: string;
}) {
  const href = caseDetailCasesListHref(tenantId, casesListReturnQuery);
  const label = casesListReturnQuery ? "← Back to patients (same filters)" : "← Patients";

  return (
    <Link href={href} className="text-sm text-blue-300 hover:underline">
      {label}
    </Link>
  );
}
