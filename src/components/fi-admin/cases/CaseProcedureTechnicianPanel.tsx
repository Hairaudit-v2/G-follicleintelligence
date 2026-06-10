"use client";

import {
  canSelectStaffForProcedureSlot,
  formatProcedureTeamPickerLabel,
  type ProcedureTeamPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { StaffReadinessPickerWarning } from "@/src/components/fi/staff/StaffClinicalPickerFields";

import { caseFormField } from "./caseFormFieldProps";

const TECH_ADD_SELECT = caseFormField("procedure-technician-add-member");

export function CaseProcedureTechnicianPanel({
  tenantId,
  technicianIds,
  userOptions,
  excludeUserIds,
  onChange,
}: {
  tenantId: string;
  technicianIds: string[];
  userOptions: ProcedureTeamPickerOption[];
  excludeUserIds?: string[];
  onChange: (next: string[]) => void;
}) {
  const exclude = new Set((excludeUserIds ?? []).filter(Boolean));

  const available = userOptions.filter(
    (u) => !technicianIds.includes(u.fi_user_id) && !exclude.has(u.fi_user_id)
  );

  function labelFor(id: string): string {
    const u = userOptions.find((x) => x.fi_user_id === id);
    if (!u) return id.slice(0, 8) + "…";
    return `${u.label} · ${u.staff_role}`;
  }

  function teamSlotFor(u: ProcedureTeamPickerOption): "clinical" | "support" {
    return u.allowed_slots.includes("clinical") ? "clinical" : "support";
  }

  const blockedSelected = technicianIds
    .map((id) => {
      const u = userOptions.find((x) => x.fi_user_id === id);
      if (!u) return null;
      const slot = teamSlotFor(u);
      return canSelectStaffForProcedureSlot(u, slot) ? null : u;
    })
    .filter((u): u is ProcedureTeamPickerOption => u != null);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-800">Technicians / assistants</h3>
      <p className="text-xs text-gray-500">
        Structured technician roster for procedure day (separate from the circulating nurse and surgeon).
      </p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={TECH_ADD_SELECT.id} className="sr-only">
          Add technician
        </label>
        <select
          {...TECH_ADD_SELECT}
          className="max-w-md rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (!v) return;
            if (!technicianIds.includes(v)) onChange([...technicianIds, v]);
          }}
        >
          <option value="">Add technician…</option>
          {available.map((u) => {
            const slot = u.allowed_slots.includes("support") ? "support" : "clinical";
            const selectable = canSelectStaffForProcedureSlot(u, slot);
            return (
              <option key={u.fi_user_id} value={u.fi_user_id} disabled={!selectable}>
                {formatProcedureTeamPickerLabel(u, slot)}
              </option>
            );
          })}
        </select>
      </div>
      {blockedSelected[0] ? (
        <StaffReadinessPickerWarning
          tenantId={tenantId}
          blockReason={blockedSelected[0]!.clinical_readiness.block_reason}
        />
      ) : null}
      {technicianIds.length === 0 ? (
        <p className="text-xs text-gray-400">No technicians selected.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {technicianIds.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-800"
            >
              <span>{labelFor(id)}</span>
              <button
                type="button"
                className="text-rose-600 hover:underline"
                onClick={() => onChange(technicianIds.filter((x) => x !== id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
