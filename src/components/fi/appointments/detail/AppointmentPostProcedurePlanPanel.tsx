import Link from "next/link";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import type { CasePostOpTrackingRow } from "@/src/lib/cases/postOpLoaders";
import type { AppointmentInstructionsSentMetadata } from "@/src/lib/bookings/appointmentMetadata";
import { appointmentCardClass } from "../shared";

export function AppointmentPostProcedurePlanPanel({
  tenantId,
  caseId,
  surgeryPlan,
  postOpTracking,
  instructionsSent,
  specialInstructions,
}: {
  tenantId: string;
  caseId: string | null;
  surgeryPlan: CaseSurgeryPlanRow | null;
  postOpTracking: CasePostOpTrackingRow | null;
  instructionsSent: AppointmentInstructionsSentMetadata;
  specialInstructions: string | null;
}) {
  return (
    <div className="space-y-4">
      <section className={appointmentCardClass}>
        <h2 className="text-sm font-semibold text-gray-900">Post-procedure plan</h2>
        <p className="mt-1 text-xs text-gray-600">
          Combines patient surgery planning, post-op tracking, and instruction packs sent from this appointment.
        </p>
        {caseId ? (
          <Link href={`/fi-admin/${tenantId}/cases/${caseId}`} className="mt-2 inline-block text-xs text-blue-600 hover:underline">
            Open patient workspace →
          </Link>
        ) : (
          <p className="mt-2 text-sm text-gray-600">No patient linked — link a patient for structured post-op tracking.</p>
        )}
      </section>

      <section className={appointmentCardClass}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Instruction packs</h3>
        <ul className="mt-2 space-y-1 text-sm text-gray-800">
          <li>Pre-op sent: {instructionsSent.pre_op_at ? new Date(instructionsSent.pre_op_at).toLocaleString() : "Not logged"}</li>
          <li>Post-op sent: {instructionsSent.post_op_at ? new Date(instructionsSent.post_op_at).toLocaleString() : "Not logged"}</li>
        </ul>
        {specialInstructions?.trim() ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
            <span className="font-medium">Special instructions: </span>
            {specialInstructions}
          </p>
        ) : null}
      </section>

      {surgeryPlan ? (
        <section className={appointmentCardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Surgery plan</h3>
          <p className="mt-2 text-sm text-gray-800">{surgeryPlan.planned_procedure_type ?? "Procedure TBC"}</p>
          {surgeryPlan.surgical_plan_summary?.trim() ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{surgeryPlan.surgical_plan_summary}</p>
          ) : null}
          {surgeryPlan.donor_strategy_notes?.trim() ? (
            <p className="mt-2 text-xs text-gray-600">
              <span className="font-medium">Donor: </span>
              {surgeryPlan.donor_strategy_notes}
            </p>
          ) : null}
          {surgeryPlan.recipient_strategy_notes?.trim() ? (
            <p className="mt-1 text-xs text-gray-600">
              <span className="font-medium">Recipient: </span>
              {surgeryPlan.recipient_strategy_notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {postOpTracking ? (
        <section className={appointmentCardClass}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Post-op tracking</h3>
          <p className="mt-2 text-sm capitalize text-gray-800">Status: {postOpTracking.post_op_status}</p>
          {postOpTracking.aftercare_notes?.trim() ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{postOpTracking.aftercare_notes}</p>
          ) : null}
          {postOpTracking.donor_recovery_notes?.trim() ? (
            <p className="mt-2 text-xs text-gray-600">Donor recovery: {postOpTracking.donor_recovery_notes}</p>
          ) : null}
          {postOpTracking.recipient_recovery_notes?.trim() ? (
            <p className="mt-1 text-xs text-gray-600">Recipient recovery: {postOpTracking.recipient_recovery_notes}</p>
          ) : null}
        </section>
      ) : caseId ? (
        <p className="text-sm text-gray-600">No post-op tracking row on the case yet.</p>
      ) : null}
    </div>
  );
}
