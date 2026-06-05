"use client";

import type { FormEvent } from "react";
import type { AppointmentProcedureMetadata } from "@/src/lib/bookings/appointmentMetadata";
import type { CrmShellUserPickerOption } from "@/src/lib/crm/types";
import { appointmentCardClass } from "./appointmentSharedStyles";

export function AppointmentProcedureSection({
  assignees,
  graftCountEstimate,
  donorArea,
  technique,
  specialInstructions,
  surgeonUserId,
  consultantUserId,
  techUserId,
  canMutate,
  busy,
  error,
  onGraftCountEstimateChange,
  onDonorAreaChange,
  onTechniqueChange,
  onSpecialInstructionsChange,
  onSurgeonUserIdChange,
  onConsultantUserIdChange,
  onTechUserIdChange,
  onSubmit,
}: {
  assignees: CrmShellUserPickerOption[];
  graftCountEstimate: string;
  donorArea: string;
  technique: string;
  specialInstructions: string;
  surgeonUserId: string;
  consultantUserId: string;
  techUserId: string;
  canMutate: boolean;
  busy: boolean;
  error: string | null;
  onGraftCountEstimateChange: (v: string) => void;
  onDonorAreaChange: (v: string) => void;
  onTechniqueChange: (v: string) => void;
  onSpecialInstructionsChange: (v: string) => void;
  onSurgeonUserIdChange: (v: string) => void;
  onConsultantUserIdChange: (v: string) => void;
  onTechUserIdChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  if (!canMutate) {
    const ro: AppointmentProcedureMetadata = {
      graft_count_estimate: graftCountEstimate.trim() || null,
      donor_area: donorArea.trim() || null,
      technique: technique.trim() || null,
      special_instructions: specialInstructions.trim() || null,
      surgeon_user_id: surgeonUserId.trim() || null,
      consultant_user_id: consultantUserId.trim() || null,
      tech_user_id: techUserId.trim() || null,
    };
    const empty = Object.values(ro).every((v) => v == null);
    if (empty) return null;
  }

  return (
    <section className={appointmentCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Procedure fields</h3>
      {canMutate ? (
        <form className="space-y-2 text-xs" onSubmit={onSubmit}>
          <label className="block text-gray-600">
            Graft count estimate
            <input
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={graftCountEstimate}
              onChange={(e) => onGraftCountEstimateChange(e.target.value)}
              placeholder="e.g. 2,400–2,800"
            />
          </label>
          <label className="block text-gray-600">
            Donor area
            <input
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={donorArea}
              onChange={(e) => onDonorAreaChange(e.target.value)}
              placeholder="Occipital, mid-scalp…"
            />
          </label>
          <label className="block text-gray-600">
            Technique
            <input
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={technique}
              onChange={(e) => onTechniqueChange(e.target.value)}
              placeholder="FUE, DHI, FUT…"
            />
          </label>
          <label className="block text-gray-600">
            Surgeon
            <select
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={surgeonUserId}
              onChange={(e) => onSurgeonUserIdChange(e.target.value)}
            >
              <option value="">—</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email?.trim() || u.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-gray-600">
            Consultant
            <select
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={consultantUserId}
              onChange={(e) => onConsultantUserIdChange(e.target.value)}
            >
              <option value="">—</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email?.trim() || u.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-gray-600">
            Technician
            <select
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              value={techUserId}
              onChange={(e) => onTechUserIdChange(e.target.value)}
            >
              <option value="">—</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email?.trim() || u.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-gray-600">
            Special instructions
            <textarea
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              rows={3}
              value={specialInstructions}
              onChange={(e) => onSpecialInstructionsChange(e.target.value)}
            />
          </label>
          {error ? <p className="text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save procedure fields"}
          </button>
        </form>
      ) : (
        <dl className="space-y-1 text-xs text-gray-700">
          {graftCountEstimate.trim() ? (
            <div>
              <dt className="text-gray-500">Graft estimate</dt>
              <dd>{graftCountEstimate}</dd>
            </div>
          ) : null}
          {donorArea.trim() ? (
            <div>
              <dt className="text-gray-500">Donor area</dt>
              <dd>{donorArea}</dd>
            </div>
          ) : null}
          {technique.trim() ? (
            <div>
              <dt className="text-gray-500">Technique</dt>
              <dd>{technique}</dd>
            </div>
          ) : null}
          {specialInstructions.trim() ? (
            <div>
              <dt className="text-gray-500">Instructions</dt>
              <dd className="whitespace-pre-wrap">{specialInstructions}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
