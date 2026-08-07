/**
 * FI-DEMO-DAY-2A.4 — Pure workforce-on-procedure-date composition.
 */

import type {
  OverviewWorkforceMember,
  OverviewWorkforceSection,
} from "./patientTwinOverviewTypes";

export type WorkforceAssignmentRow = {
  role: string;
  displayName: string | null;
  assignmentStatus?: string | null;
  competencyValidOnProcedureDate?: boolean | null;
  competencyLabel?: string | null;
};

export function composeOverviewWorkforce(input: {
  members: ReadonlyArray<WorkforceAssignmentRow>;
  procedureDate: string | null;
}): OverviewWorkforceSection {
  const members: OverviewWorkforceMember[] = input.members
    .filter((m) => (m.displayName?.trim() || m.role.trim()).length > 0)
    .map((m) => {
      const valid = m.competencyValidOnProcedureDate;
      let competencyNote: string | null = null;
      if (valid === true) {
        competencyNote =
          m.competencyLabel?.trim() ||
          "Competency recorded as valid on the procedure date.";
      } else if (valid === false) {
        competencyNote = "Competency not confirmed valid on the procedure date.";
      } else {
        competencyNote = "Competency validity on procedure date not recorded.";
      }
      return {
        displayName: m.displayName?.trim() || "Staff member",
        role: m.role.trim() || "role",
        competencyValidOnProcedureDate: valid ?? null,
        competencyNote,
      };
    });

  if (members.length === 0) {
    return {
      availability: input.procedureDate ? "not_recorded" : "not_applicable",
      members: [],
      procedureDate: input.procedureDate,
    };
  }

  return {
    availability: "recorded",
    members,
    procedureDate: input.procedureDate,
  };
}
