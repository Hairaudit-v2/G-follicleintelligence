/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — identity preflight server entry.
 * Loads readiness identity bag then evaluates fail-closed pure preflight.
 * Does not enrol, invite, or approve patients.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadPilotEnrolmentForPatient } from "../pilotCohortQuery.server";
import { loadPilotReadinessSourceBag } from "../readiness/loadPilotReadinessSources.server";
import {
  evaluatePilotPatientIdentityPreflight,
  type IdentityPreflightInput,
} from "./identityPreflight";
import {
  PILOT_ACTIVATION_VERSION,
  type PilotIdentityPreflightResult,
} from "./activationTypes";

export async function evaluatePilotPatientIdentityPreflightServer(args: {
  tenantId: string;
  programmeId: string;
  patientId: string;
  supabase?: SupabaseClient;
  isSyntheticOrSmokeFixture?: boolean;
}): Promise<PilotIdentityPreflightResult> {
  const loaded = await loadPilotEnrolmentForPatient(
    {
      tenantId: args.tenantId,
      programmeId: args.programmeId,
      patientId: args.patientId,
    },
    { supabase: args.supabase }
  );

  if (!loaded.ok) {
    return evaluatePilotPatientIdentityPreflight({
      tenantId: args.tenantId,
      programmeId: args.programmeId,
      patientId: args.patientId,
      patientFound: false,
      patientTenantId: null,
      ambiguousPatient: loaded.code === "ambiguous_enrolment",
      appAuthUserId: null,
      appLinkagePatientCount: 0,
      crmLeadPatientIdConflict: false,
      quotePatientId: null,
      consentPatientId: null,
      documentPatientId: null,
      imagePatientIds: [],
      journeyPatientId: null,
      activeEnrolmentCountForProgrammePatient:
        loaded.code === "ambiguous_enrolment" ? 2 : 0,
      isSyntheticOrSmokeFixture: Boolean(args.isSyntheticOrSmokeFixture),
    });
  }

  const bag = await loadPilotReadinessSourceBag(
    { tenantId: args.tenantId, enrolment: loaded.enrolment },
    { supabase: args.supabase }
  );

  const consentPatientId = bag.consentDocuments.consentWrongPatient
    ? "__wrong_patient__"
    : args.patientId;

  const input: IdentityPreflightInput = {
    tenantId: args.tenantId,
    programmeId: args.programmeId,
    patientId: args.patientId,
    evaluatedAt: bag.evaluatedAt,
    patientFound: bag.identity.patientFound,
    patientTenantId: bag.identity.patientTenantId,
    ambiguousPatient: bag.identity.ambiguousPatient,
    appAuthUserId: bag.identity.appAuthUserId,
    appLinkagePatientCount: bag.identity.appLinkagePatientCount,
    crmLeadPatientIdConflict: bag.identity.crmLeadPatientIdConflict,
    quotePatientId: bag.financial.quotePatientId,
    consentPatientId,
    documentPatientId: args.patientId,
    imagePatientIds: [],
    journeyPatientId: args.patientId,
    activeEnrolmentCountForProgrammePatient:
      bag.identity.activeEnrolmentCountForProgrammePatient,
    isSyntheticOrSmokeFixture: Boolean(args.isSyntheticOrSmokeFixture),
    crossTenantMapping: bag.identity.crossTenantMapping,
    sourcePatientIdMismatch: bag.identity.sourcePatientIdMismatch,
  };

  const result = evaluatePilotPatientIdentityPreflight(input);
  return { ...result, version: PILOT_ACTIVATION_VERSION };
}
