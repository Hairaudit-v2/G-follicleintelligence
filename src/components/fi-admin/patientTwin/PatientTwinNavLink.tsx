import Link from "next/link";

import { cn } from "@/lib/utils";
import { fiButtonVariantClassNames } from "@/src/components/fi-design/fiDesignTokens";

export type PatientTwinNavLinkProps = {
  tenantId: string;
  /** Foundation `fi_patients.id` — Patient Twin route segment. */
  patientId: string;
  className?: string;
};

/**
 * Secondary navigation to the read-only Patient Twin dashboard (consistent FI admin labelling).
 */
export function PatientTwinNavLink({ tenantId, patientId, className }: PatientTwinNavLinkProps) {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return null;

  const href = `/fi-admin/${tid}/patients/${pid}/twin`;

  return (
    <Link
      href={href}
      className={cn(
        fiButtonVariantClassNames.neutral,
        "inline-flex max-w-full flex-col items-start justify-center gap-0.5 text-left no-underline hover:no-underline",
        className
      )}
    >
      <span className="leading-tight">Patient Twin</span>
      <span className="text-xs font-normal leading-snug text-slate-500">
        View the unified longitudinal patient record.
      </span>
    </Link>
  );
}
