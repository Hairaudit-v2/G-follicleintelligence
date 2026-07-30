/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — migration / remote evidence model (pure).
 * Applying migrations must not activate the programme.
 */

export type MigrationEvidenceRecord = {
  remoteProjectId: string | null;
  migrationVersion: string;
  migrationChecksum: string | null;
  appliedAt: string | null;
  applyingOperator: string | null;
  schemaVerified: boolean;
  tablesVerified: boolean;
  indexesVerified: boolean;
  foreignKeysVerified: boolean;
  rlsVerified: boolean;
  rollbackPlanDocumented: boolean;
  backupOrRecoveryPosition: string | null;
  realPatientEnrolmentsCreated: boolean;
  realPatientInvitationsEnabled: boolean;
  programmeActivatedByMigration: boolean;
};

export const PILOT_1B_REQUIRED_MIGRATION_VERSIONS = [
  "202611041001",
  "202611041002",
  "202611041003",
] as const;

export const PILOT_1B_REQUIRED_TABLES = [
  "fi_pilot_programmes",
  "fi_pilot_enrolments",
  "fi_pilot_control_events",
  "fi_pilot_blockers",
  "fi_pilot_activation_decisions",
  "fi_pilot_cohort_candidate_reviews",
] as const;

export function evaluateMigrationEvidence(
  evidence: MigrationEvidenceRecord
): {
  appliedAndProven: boolean;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!evidence.remoteProjectId) blockers.push("remote_project_id_missing");
  if (!evidence.appliedAt) blockers.push("applied_timestamp_missing");
  if (!evidence.applyingOperator) blockers.push("applying_operator_missing");
  if (!evidence.migrationChecksum) warnings.push("migration_checksum_pending");
  if (!evidence.schemaVerified) blockers.push("schema_not_verified");
  if (!evidence.tablesVerified) blockers.push("tables_not_verified");
  if (!evidence.indexesVerified) blockers.push("indexes_not_verified");
  if (!evidence.foreignKeysVerified) blockers.push("foreign_keys_not_verified");
  if (!evidence.rlsVerified) blockers.push("rls_not_verified");
  if (!evidence.rollbackPlanDocumented) blockers.push("rollback_plan_missing");
  if (!evidence.backupOrRecoveryPosition) warnings.push("backup_position_unrecorded");

  if (evidence.realPatientEnrolmentsCreated) {
    blockers.push("real_patient_enrolments_created_by_migration");
  }
  if (evidence.realPatientInvitationsEnabled) {
    blockers.push("invitations_enabled_by_migration");
  }
  if (evidence.programmeActivatedByMigration) {
    blockers.push("programme_activated_by_migration");
  }

  return {
    appliedAndProven: blockers.length === 0,
    blockers,
    warnings,
  };
}

/** Default evidence stub — remote apply is pending until operator records it. */
export function pendingMigrationEvidenceStub(
  migrationVersion: string
): MigrationEvidenceRecord {
  return {
    remoteProjectId: null,
    migrationVersion,
    migrationChecksum: null,
    appliedAt: null,
    applyingOperator: null,
    schemaVerified: false,
    tablesVerified: false,
    indexesVerified: false,
    foreignKeysVerified: false,
    rlsVerified: false,
    rollbackPlanDocumented: true,
    backupOrRecoveryPosition: null,
    realPatientEnrolmentsCreated: false,
    realPatientInvitationsEnabled: false,
    programmeActivatedByMigration: false,
  };
}
