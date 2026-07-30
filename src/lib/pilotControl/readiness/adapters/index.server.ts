/**
 * Additional named adapter entrypoints matching 1A.2 suggested layout.
 * Each delegates to the pure dimension resolvers / shared source bag.
 */
import "server-only";

export { runIdentityReadinessAdapter } from "./identityReadinessAdapter.server";
export { runClinicalReadinessAdapter } from "./clinicalReadinessAdapter.server";
export { runFinancialReadinessAdapter } from "./financialReadinessAdapter.server";
export { runPatientReadinessAdapter } from "./patientReadinessAdapter.server";
export { runOperationalReadinessAdapter } from "./operationalReadinessAdapter.server";
export { runTechnicalReadinessAdapter } from "./technicalReadinessAdapter.server";

// Journey / consultation / pathology / consent / document / image / appointment /
// communication / patient-app adapters are composed inside loadPilotReadinessSources
// + dimension resolvers (avoid duplicate cross-domain queries).
