import { cn } from "@/lib/utils";
import {
  financialOsStatusBadgeBase,
  financialOsStatusBadgeTones,
  resolveFinancialOsRecordStatusTone,
} from "@/src/components/fi-admin/financial-os/financialOsStatusBadgeStyles";

export function FinancialOsRecordStatusBadge(props: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = resolveFinancialOsRecordStatusTone(props.status);
  const label = props.label ?? props.status.replace(/_/g, " ");

  return (
    <span className={cn(financialOsStatusBadgeBase, financialOsStatusBadgeTones[tone], props.className)}>
      {label}
    </span>
  );
}
