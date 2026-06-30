import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import {
  clinicalStaffingDisplayStatusLabel,
  clinicalStaffingDisplayStatusTone,
} from "@/src/lib/workforce-os/clinicalStaffingStatusDisplay";
import type { ClinicalStaffingDisplayStatus } from "@/src/lib/workforce-os/clinicalStaffingSummary.types";

export type ClinicalStaffingStatusBadgeProps = {
  status: ClinicalStaffingDisplayStatus;
  compact?: boolean;
  className?: string;
};

export function ClinicalStaffingStatusBadge({
  status,
  compact,
  className,
}: ClinicalStaffingStatusBadgeProps) {
  const tone = clinicalStaffingDisplayStatusTone(status);
  const label = clinicalStaffingDisplayStatusLabel(status);

  return (
    <FiStatusBadge
      tone={tone}
      appearance="pill"
      density={compact ? "compact" : "default"}
      className={className}
    >
      {label}
    </FiStatusBadge>
  );
}
