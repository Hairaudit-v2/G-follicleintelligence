/**
 * Prerequisite gates for photoreal generation — patient sharing always unavailable in 1B.
 */

import { lifecycleFromPrerequisites } from "@follicle/projection-core/client";
import type { CaseSurgeryPlanRow } from "@/src/lib/cases/surgeryPlanningLoaders";
import type { HairlineDesignRow } from "./hairlineDomain";
import {
  allocationMapWarnings,
  type PlannedZoneRow,
} from "@/src/lib/cases/surgeryPlanningTypes";

export type SurgeryProjectionReadiness = {
  planApproved: boolean;
  hairlineApproved: boolean;
  allocationMapReady: boolean;
  canRequestGeneration: boolean;
  patientSharingAvailable: false;
  lifecycleHint: ReturnType<typeof lifecycleFromPrerequisites>;
  blockers: string[];
  allocationWarnings: string[];
};

export function evaluateSurgeryProjectionReadiness(input: {
  plan: CaseSurgeryPlanRow | null;
  approvedHairline: HairlineDesignRow | null;
  zones?: PlannedZoneRow[];
}): SurgeryProjectionReadiness {
  const planApproved = input.plan?.planning_status === "approved";
  const hairlineApproved = input.approvedHairline?.status === "approved";
  const zones = input.zones ?? input.plan?.planned_zones ?? [];
  const allocationWarnings = allocationMapWarnings(zones);
  const allocationMapReady = Boolean(input.plan) && zones.length > 0;

  const blockers: string[] = [];
  if (!input.plan) blockers.push("Create a surgical plan first.");
  else if (!planApproved) blockers.push("Approve the surgical plan before generation.");
  if (!hairlineApproved) {
    blockers.push("Approve a photo-bound hairline design before generation.");
  }
  if (!allocationMapReady) blockers.push("Define planned zones for the allocation map.");

  const lifecycleHint = lifecycleFromPrerequisites({ planApproved, hairlineApproved });

  return {
    planApproved,
    hairlineApproved,
    allocationMapReady,
    canRequestGeneration: planApproved && hairlineApproved,
    patientSharingAvailable: false,
    lifecycleHint,
    blockers,
    allocationWarnings,
  };
}
