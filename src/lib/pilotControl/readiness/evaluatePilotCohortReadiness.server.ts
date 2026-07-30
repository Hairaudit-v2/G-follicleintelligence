/**
 * Cohort readiness evaluation — re-export for suggested 1A.2 entrypoint name.
 */
import "server-only";

export {
  evaluatePilotCohortReadiness,
  evaluatePilotPatientReadiness,
  resolveProgrammeIdForTenant,
  PilotReadinessEvaluationError,
} from "./evaluatePilotPatientReadiness.server";
