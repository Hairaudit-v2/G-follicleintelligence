"use client";

import Link from "next/link";

import type {
  ClinicalStaffPickerOption,
  ProcedureTeamPickerOption,
  ProcedureTeamSlotKind,
} from "@/src/lib/staff/clinicalStaffPicker";
import {
  canSelectStaffForClinicalPicker,
  canSelectStaffForProcedureSlot,
  formatClinicalPickerOptionLabel,
  formatProcedureTeamPickerLabel,
  staffReadinessDashboardPath,
} from "@/src/lib/staff/clinicalStaffPicker";
import { staffOptionPrimaryLabel } from "@/src/lib/staff/staffAssigneeDisplay";

export function StaffClinicalSelect({
  tenantId,
  options,
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = "Unassigned",
  className = "mt-0.5 w-full rounded border border-slate-700 px-2 py-1.5 text-sm",
  id,
  disabled,
}: {
  tenantId: string;
  options: ClinicalStaffPickerOption[];
  value: string;
  onChange: (staffId: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const selected = options.find((o) => o.id === value.trim()) ?? null;
  return (
    <div>
      <select
        id={id}
        className={className}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((o) => {
          const selectable = canSelectStaffForClinicalPicker(o);
          return (
            <option key={o.id} value={o.id} disabled={!selectable}>
              {formatClinicalPickerOptionLabel(o)}
            </option>
          );
        })}
        {value.trim() && !selected ? (
          <option value={value.trim()}>Recorded assignee (not in active staff list)</option>
        ) : null}
      </select>
      {selected && !selected.clinical_readiness.clinically_available ? (
        <StaffReadinessPickerWarning tenantId={tenantId} blockReason={selected.clinical_readiness.block_reason} />
      ) : null}
    </div>
  );
}

export function StaffReadinessPickerWarning({
  tenantId,
  blockReason,
}: {
  tenantId: string;
  blockReason: string | null;
}) {
  if (!blockReason?.trim()) return null;
  return (
    <p className="mt-1 text-[11px] leading-snug text-amber-300">
      {blockReason}.{" "}
      <Link href={staffReadinessDashboardPath(tenantId)} className="font-medium text-amber-200 underline">
        Open readiness dashboard
      </Link>
    </p>
  );
}

export function ProcedureTeamSelect({
  tenantId,
  options,
  value,
  onChange,
  slot,
  allowEmpty = true,
  emptyLabel = "—",
  className = "mt-1 block w-full rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1.5 text-sm",
  id,
}: {
  tenantId: string;
  options: ProcedureTeamPickerOption[];
  value: string;
  onChange: (fiUserId: string) => void;
  slot: ProcedureTeamSlotKind;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  id?: string;
}) {
  const selected = options.find((o) => o.fi_user_id === value.trim()) ?? null;
  return (
    <div>
      <select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((o) => {
          const selectable = canSelectStaffForProcedureSlot(o, slot);
          return (
            <option key={o.fi_user_id} value={o.fi_user_id} disabled={!selectable}>
              {formatProcedureTeamPickerLabel(o, slot)}
            </option>
          );
        })}
        {value.trim() && !selected ? (
          <option value={value.trim()}>Recorded assignee (not in active staff list)</option>
        ) : null}
      </select>
      {selected && !canSelectStaffForProcedureSlot(selected, slot) ? (
        <StaffReadinessPickerWarning tenantId={tenantId} blockReason={selected.clinical_readiness.block_reason} />
      ) : null}
    </div>
  );
}

/** Label helper when only CrmShell options without full clinical enrichment. */
export function staffPickerLabelFallback(
  option: { full_name?: string | null; email?: string | null; id: string }
): string {
  return staffOptionPrimaryLabel(option as ClinicalStaffPickerOption);
}
