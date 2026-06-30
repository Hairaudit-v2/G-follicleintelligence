import type { ReactNode } from "react";

import {
  caseDetailSectionHeadingId,
  type CaseDetailSectionId,
} from "@/src/lib/cases/caseDetailNavConstants";

/**
 * Wraps a major SurgeryOS block with a stable anchor and scroll margin for sticky section nav.
 */
export function CaseDetailSection({
  id,
  children,
  className = "",
}: {
  id: CaseDetailSectionId;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={caseDetailSectionHeadingId(id)}
      className={`scroll-mt-28 ${className}`}
    >
      {children}
    </section>
  );
}
