"use client";

import {
  canSelectStaffForProcedureSlot,
  formatProcedureTeamPickerLabel,
  type ProcedureTeamPickerOption,
} from "@/src/lib/staff/clinicalStaffPicker";
import { StaffReadinessPickerWarning } from "@/src/components/fi/staff/StaffClinicalPickerFields";

import { caseFormField } from "./caseFormFieldProps";

const TEAM_MEMBER_SELECT = caseFormField("procedure-team-add-member");

export function CaseProcedureTeamPanel({
  tenantId,
  teamIds,
  userOptions,
  excludeUserIds,
  onChange,
}: {
  tenantId: string;
  teamIds: string[];
  userOptions: ProcedureTeamPickerOption[];
  excludeUserIds?: string[];
  onChange: (next: string[]) => void;
}) {
  const exclude = new Set((excludeUserIds ?? []).filter(Boolean));

  const available = userOptions.filter(
    (u) => !teamIds.includes(u.fi_user_id) && !exclude.has(u.fi_user_id)
  );

  function labelFor(id: string): string {
    const u = userOptions.find((x) => x.fi_user_id === id);
    if (!u) return id.slice(0, 8) + "…";
    return `${u.label} · ${u.staff_role}`;
  }

  function teamSlotFor(u: ProcedureTeamPickerOption): "clinical" | "support" {
    return u.allowed_slots.includes("clinical") ? "clinical" : "support";
  }

  const blockedSelected = teamIds
    .map((id) => {
      const u = userOptions.find((x) => x.fi_user_id === id);
      if (!u) return null;
      const slot = teamSlotFor(u);
      return canSelectStaffForProcedureSlot(u, slot) ? null : u;
    })
    .filter((u): u is ProcedureTeamPickerOption => u != null);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-200">Additional team</h3>
      <p className="text-xs text-gray-500">
        Coordinators, trainees, or other staff not captured as surgeon, nurse, or technicians above (legacy mixed list
        is still supported).
      </p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={TEAM_MEMBER_SELECT.id} className="sr-only">
          Add team member
        </label>
        <select
          {...TEAM_MEMBER_SELECT}
          className="max-w-md rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-sm"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (!v) return;
            if (!teamIds.includes(v)) onChange([...teamIds, v]);
          }}
        >
          <option value="">Add team member…</option>
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
      {teamIds.length === 0 ? (
        <p className="text-xs text-gray-400">No team members selected.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {teamIds.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-xs text-slate-200"
            >
              <span>{labelFor(id)}</span>
              <button type="button" className="text-rose-300 hover:underline" onClick={() => onChange(teamIds.filter((x) => x !== id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
