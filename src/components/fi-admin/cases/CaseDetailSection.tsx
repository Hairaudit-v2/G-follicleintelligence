import type { ReactNode } from "react";

/**
 * Wraps a major SurgeryOS block with a stable anchor and scroll margin for sticky section nav.
 */
export function CaseDetailSection({
  id,
  children,
  className = "",
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-28 ${className}`}>
      {children}
    </section>
  );
}
