import type { CanonicalServiceRoleId } from "@/src/lib/services/setup/canonicalServiceRoles";
import type {
  ServiceFamilyId,
  ServiceSetupConfig,
  StaffAllocationMode,
  StaffAllocationStrategy,
  SurgicalTeamSlotConfig,
} from "@/src/lib/services/setup/serviceSetupTypes";
import { emptyServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupDefaults";

export type ServiceFamilyTemplate = {
  id: ServiceFamilyId;
  label: string;
  description: string;
  eligibleRoles: CanonicalServiceRoleId[];
  staffAllocationMode: StaffAllocationMode;
  staffAllocationStrategy: StaffAllocationStrategy;
  preferredRoleOrder: CanonicalServiceRoleId[];
  roomRequirement: ServiceSetupConfig["rooms"]["requirement"];
  automaticRoomAllocation: boolean;
  competency: ServiceSetupConfig["competency"];
  surgicalTeam: SurgicalTeamSlotConfig[] | null;
};

const SURGERY_TEAM_DEFAULT: SurgicalTeamSlotConfig[] = [
  { slot: "doctor", required: true, minimum: 1, preferred: 1, automaticallyAllocate: true },
  { slot: "nurse", required: true, minimum: 1, preferred: 2, automaticallyAllocate: true },
  { slot: "technician", required: true, minimum: 1, preferred: 2, automaticallyAllocate: true },
  { slot: "assistant", required: false, minimum: 0, preferred: 1, automaticallyAllocate: true },
];

export const SERVICE_FAMILY_TEMPLATES: Record<ServiceFamilyId, ServiceFamilyTemplate> = {
  consultation: {
    id: "consultation",
    label: "Consultation",
    description: "Initial or specialty consult with preferred consultant / doctor.",
    eligibleRoles: ["consultant", "trichologist", "doctor", "surgeon"],
    staffAllocationMode: "automatic",
    staffAllocationStrategy: "preferred_role_order",
    preferredRoleOrder: ["consultant", "trichologist", "doctor", "surgeon"],
    roomRequirement: "required",
    automaticRoomAllocation: true,
    competency: {
      minimumClinicalTier: 2,
      requiredCertificationKeys: [],
      supervisionAllowed: true,
      surgeryLeadRequired: false,
    },
    surgicalTeam: null,
  },
  follow_up: {
    id: "follow_up",
    label: "Follow-up",
    description: "Review / follow-up visit with continuity of care preferred.",
    eligibleRoles: ["consultant", "trichologist", "doctor", "nurse"],
    staffAllocationMode: "automatic",
    staffAllocationStrategy: "continuity_of_care",
    preferredRoleOrder: ["consultant", "doctor", "trichologist", "nurse"],
    roomRequirement: "optional",
    automaticRoomAllocation: true,
    competency: {
      minimumClinicalTier: 1,
      requiredCertificationKeys: [],
      supervisionAllowed: true,
      surgeryLeadRequired: false,
    },
    surgicalTeam: null,
  },
  hair_treatment: {
    id: "hair_treatment",
    label: "Hair Treatment",
    description: "PRP / regenerative / non-surgical treatment delivery.",
    eligibleRoles: ["nurse", "doctor", "technician"],
    staffAllocationMode: "automatic",
    staffAllocationStrategy: "best_availability",
    preferredRoleOrder: ["nurse", "doctor", "technician"],
    roomRequirement: "required",
    automaticRoomAllocation: true,
    competency: {
      minimumClinicalTier: 2,
      requiredCertificationKeys: ["regenerative_treatment"],
      supervisionAllowed: true,
      surgeryLeadRequired: false,
    },
    surgicalTeam: null,
  },
  surgery: {
    id: "surgery",
    label: "Surgery",
    description: "Surgical procedure with multi-role team requirements.",
    eligibleRoles: ["surgeon", "doctor", "nurse", "technician", "clinical_assistant"],
    staffAllocationMode: "automatic",
    staffAllocationStrategy: "preferred_role_order",
    preferredRoleOrder: ["surgeon", "doctor", "nurse", "technician", "clinical_assistant"],
    roomRequirement: "required",
    automaticRoomAllocation: true,
    competency: {
      minimumClinicalTier: 4,
      requiredCertificationKeys: ["surgery_privilege"],
      supervisionAllowed: false,
      surgeryLeadRequired: true,
    },
    surgicalTeam: SURGERY_TEAM_DEFAULT,
  },
  trichology_diagnostic: {
    id: "trichology_diagnostic",
    label: "Trichology / Diagnostic",
    description: "Trichoscopy and diagnostic assessment.",
    eligibleRoles: ["trichologist", "consultant", "doctor"],
    staffAllocationMode: "automatic",
    staffAllocationStrategy: "preferred_role_order",
    preferredRoleOrder: ["trichologist", "consultant", "doctor"],
    roomRequirement: "required",
    automaticRoomAllocation: true,
    competency: {
      minimumClinicalTier: 3,
      requiredCertificationKeys: ["trichoscopy"],
      supervisionAllowed: true,
      surgeryLeadRequired: false,
    },
    surgicalTeam: null,
  },
  administrative: {
    id: "administrative",
    label: "Administrative",
    description: "Block time, admin holds, and non-clinical tasks.",
    eligibleRoles: ["admin", "reception", "coordinator", "consultant"],
    staffAllocationMode: "assign_later",
    staffAllocationStrategy: "lowest_workload",
    preferredRoleOrder: ["admin", "reception", "coordinator"],
    roomRequirement: "not_required",
    automaticRoomAllocation: false,
    competency: {
      minimumClinicalTier: null,
      requiredCertificationKeys: [],
      supervisionAllowed: true,
      surgeryLeadRequired: false,
    },
    surgicalTeam: null,
  },
  custom: {
    id: "custom",
    label: "Custom",
    description: "Blank template — configure roles, rooms, and allocation manually.",
    eligibleRoles: [],
    staffAllocationMode: "manual",
    staffAllocationStrategy: "preferred_named_staff",
    preferredRoleOrder: [],
    roomRequirement: "optional",
    automaticRoomAllocation: false,
    competency: {
      minimumClinicalTier: null,
      requiredCertificationKeys: [],
      supervisionAllowed: true,
      surgeryLeadRequired: false,
    },
    surgicalTeam: null,
  },
};

export function applyServiceFamilyTemplate(
  familyId: ServiceFamilyId,
  base: ServiceSetupConfig = emptyServiceSetupConfig()
): ServiceSetupConfig {
  const t = SERVICE_FAMILY_TEMPLATES[familyId];
  return {
    ...base,
    version: 1,
    serviceFamily: familyId,
    eligibleRoles: [...t.eligibleRoles],
    legacyRolesForReview: [...base.legacyRolesForReview],
    staffAllocation: {
      mode: t.staffAllocationMode,
      strategy: t.staffAllocationStrategy,
      preferredRoleOrder: [...t.preferredRoleOrder],
      preferredStaffIds: [...base.staffAllocation.preferredStaffIds],
    },
    competency: {
      minimumClinicalTier: t.competency.minimumClinicalTier,
      requiredCertificationKeys: [...t.competency.requiredCertificationKeys],
      supervisionAllowed: t.competency.supervisionAllowed,
      surgeryLeadRequired: t.competency.surgeryLeadRequired,
    },
    surgicalTeam: t.surgicalTeam
      ? t.surgicalTeam.map((s) => ({ ...s }))
      : null,
    rooms: {
      ...base.rooms,
      requirement: t.roomRequirement,
      automaticAllocation: t.automaticRoomAllocation,
    },
  };
}

export function inferServiceFamilyFromBookingType(
  bookingType: string | null | undefined,
  serviceName?: string | null
): ServiceFamilyId {
  const bt = String(bookingType ?? "")
    .trim()
    .toLowerCase();
  const name = String(serviceName ?? "")
    .trim()
    .toLowerCase();

  if (bt === "surgery" || (/\bsurgery\b|\bfue\b|\btransplant\b/.test(name) && !/\bconsult/.test(name))) {
    return "surgery";
  }
  if (bt === "follow_up" || bt === "review" || /\bfollow[- ]?up\b|\breview\b/.test(name)) {
    return "follow_up";
  }
  if (
    bt === "prp" ||
    bt === "prf" ||
    bt === "exosomes" ||
    bt === "mesotherapy" ||
    /\bprp\b|\bprf\b|\bexosome|\bmeso|\btreatment\b/.test(name)
  ) {
    return "hair_treatment";
  }
  if (bt === "trichology" || /\btricholog|\bdiagnostic|\btrichoscop/.test(name)) {
    return "trichology_diagnostic";
  }
  if (
    bt === "consultation" ||
    bt.includes("consultation") ||
    /\bconsult/.test(name)
  ) {
    return "consultation";
  }
  if (bt === "other" || /\badmin\b|\bblock\s*time\b|\binternal\b/.test(name)) {
    return "administrative";
  }
  return "custom";
}
