"use client";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { EMPTY_COHORT_MESSAGE } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";
import { formatProgrammeStatus } from "@/src/lib/pilotControl/ui/pilotControlFormatters";

export function PilotEmptyState({
  programmeName,
  programmeStatus,
  realInvitesEnabled,
  migrationsOk,
}: {
  programmeName?: string;
  programmeStatus?: string;
  realInvitesEnabled?: boolean;
  migrationsOk?: boolean;
}) {
  return (
    <InfoNotice variant="warning" title="Insufficient live pilot evidence">
      <p className="whitespace-pre-line text-sm">{EMPTY_COHORT_MESSAGE}</p>
      <ul className="mt-3 space-y-1 text-xs text-amber-100/90">
        {programmeName ? (
          <li>
            Programme: <strong className="font-semibold text-amber-50">{programmeName}</strong>
          </li>
        ) : null}
        {programmeStatus ? (
          <li>
            Status:{" "}
            <strong className="font-semibold text-amber-50">
              {formatProgrammeStatus(programmeStatus)}
            </strong>
          </li>
        ) : null}
        <li>
          Real patient invitations:{" "}
          <strong className="font-semibold text-amber-50">
            {realInvitesEnabled ? "Enabled" : "Disabled"}
          </strong>
        </li>
        <li>
          Migration status:{" "}
          <strong className="font-semibold text-amber-50">
            {migrationsOk === false ? "Missing required tables" : "Governed (verify before live use)"}
          </strong>
        </li>
        <li>Next authorised action: complete 1A.6 gates before inviting real patients.</li>
      </ul>
    </InfoNotice>
  );
}
