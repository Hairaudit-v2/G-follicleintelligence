import type { FiStaffPositionTypeCode } from "@/src/config/fiOrganisationalIntelligenceRegistry";
import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";

export const ENTERPRISE_DEMO_STAFF_EMAIL_DOMAIN = "follicleintelligence.local";

export type EnterpriseDemoHierarchyScope = "global" | "clinic";

export type EnterpriseDemoStaffHierarchyNode = {
  /** Stable idempotency key stored in `fi_staff.staff_metadata.demo_staff_key`. */
  key: string;
  fullName: string;
  positionTypeCode: FiStaffPositionTypeCode;
  staffRole: string;
  positionTitle: string;
  hierarchyScope: EnterpriseDemoHierarchyScope;
  hierarchyLevel: number;
  clinicSlug: string | null;
  reportsToKey: string | null;
  email: string;
  calendarColor: string;
  defaultTimezone: string;
};

const CALENDAR_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#6366f1",
] as const;

const POSITION_TO_STAFF_ROLE: Record<FiStaffPositionTypeCode, string> = {
  DIRECTOR: "director",
  CLINIC_MANAGER: "clinic_manager",
  SURGEON: "surgeon",
  DOCTOR: "doctor",
  RN: "nurse",
  TECHNICIAN: "technician",
  CONSULTANT: "consultant",
  RECEPTION: "reception",
  ACADEMY_TRAINER: "admin",
  AUDITOR: "auditor",
  FINANCE_ADMIN: "admin",
  DATA_SAFETY_ADMIN: "admin",
};

const GLOBAL_LEADERSHIP: Array<{
  key: string;
  fullName: string;
  positionTypeCode: FiStaffPositionTypeCode;
  positionTitle: string;
  reportsToKey: string | null;
  hierarchyLevel: number;
}> = [
  {
    key: "global-ceo",
    fullName: "Dr. Helena Voss",
    positionTypeCode: "DIRECTOR",
    positionTitle: "Group Chief Executive",
    reportsToKey: null,
    hierarchyLevel: 0,
  },
  {
    key: "global-cmo",
    fullName: "Dr. Marcus Webb",
    positionTypeCode: "DIRECTOR",
    positionTitle: "Chief Medical Officer",
    reportsToKey: "global-ceo",
    hierarchyLevel: 1,
  },
  {
    key: "global-ops-director",
    fullName: "Elena Kourou",
    positionTypeCode: "CLINIC_MANAGER",
    positionTitle: "Group Operations Director",
    reportsToKey: "global-ceo",
    hierarchyLevel: 1,
  },
  {
    key: "global-finance-director",
    fullName: "James Okafor",
    positionTypeCode: "FINANCE_ADMIN",
    positionTitle: "Group Finance Director",
    reportsToKey: "global-ceo",
    hierarchyLevel: 1,
  },
  {
    key: "global-quality-director",
    fullName: "Sophie Laurent",
    positionTypeCode: "AUDITOR",
    positionTitle: "Group Quality & Compliance Director",
    reportsToKey: "global-cmo",
    hierarchyLevel: 2,
  },
];

type ClinicStaffRoleKey =
  | "clinicDirector"
  | "leadSurgeon"
  | "seniorConsultant"
  | "consultant"
  | "leadNurse"
  | "technician"
  | "receptionLead";

const CLINIC_STAFF_TEMPLATE: Array<{
  suffix: string;
  roleKey: ClinicStaffRoleKey;
  positionTypeCode: FiStaffPositionTypeCode;
  positionTitle: string;
  reportsToSuffix: string | "global-ops-director";
  hierarchyLevel: number;
}> = [
  {
    suffix: "clinic-director",
    roleKey: "clinicDirector",
    positionTypeCode: "CLINIC_MANAGER",
    positionTitle: "Clinic Director",
    reportsToSuffix: "global-ops-director",
    hierarchyLevel: 1,
  },
  {
    suffix: "lead-surgeon",
    roleKey: "leadSurgeon",
    positionTypeCode: "SURGEON",
    positionTitle: "Lead Surgeon",
    reportsToSuffix: "clinic-director",
    hierarchyLevel: 2,
  },
  {
    suffix: "senior-consultant",
    roleKey: "seniorConsultant",
    positionTypeCode: "CONSULTANT",
    positionTitle: "Senior Consultant",
    reportsToSuffix: "clinic-director",
    hierarchyLevel: 2,
  },
  {
    suffix: "consultant",
    roleKey: "consultant",
    positionTypeCode: "CONSULTANT",
    positionTitle: "Hair Restoration Consultant",
    reportsToSuffix: "senior-consultant",
    hierarchyLevel: 3,
  },
  {
    suffix: "lead-nurse",
    roleKey: "leadNurse",
    positionTypeCode: "RN",
    positionTitle: "Lead Theatre Nurse",
    reportsToSuffix: "lead-surgeon",
    hierarchyLevel: 3,
  },
  {
    suffix: "technician",
    roleKey: "technician",
    positionTypeCode: "TECHNICIAN",
    positionTitle: "Theatre Technician",
    reportsToSuffix: "lead-nurse",
    hierarchyLevel: 4,
  },
  {
    suffix: "reception-lead",
    roleKey: "receptionLead",
    positionTypeCode: "RECEPTION",
    positionTitle: "Reception Lead",
    reportsToSuffix: "clinic-director",
    hierarchyLevel: 2,
  },
];

const CLINIC_STAFF_NAMES: Record<string, Record<ClinicStaffRoleKey, string>> = {
  "london-central-institute": {
    clinicDirector: "Oliver Harrington",
    leadSurgeon: "Dr. Charlotte Finch",
    seniorConsultant: "Amelia Graves",
    consultant: "Harry Sullivan",
    leadNurse: "Emily Clarke",
    technician: "Daniel Wright",
    receptionLead: "Sophie Bennett",
  },
  "dubai-hair-institute": {
    clinicDirector: "Fatima Al Mansoori",
    leadSurgeon: "Dr. Khalid Rahman",
    seniorConsultant: "Layla Hassan",
    consultant: "Omar Farouk",
    leadNurse: "Nadia Qureshi",
    technician: "Yusuf Malik",
    receptionLead: "Sara Al Hashimi",
  },
  "sydney-hair-institute": {
    clinicDirector: "Liam O'Connor",
    leadSurgeon: "Dr. Priya Sharma",
    seniorConsultant: "Jessica Nguyen",
    consultant: "Ethan Brooks",
    leadNurse: "Mia Patterson",
    technician: "Noah Campbell",
    receptionLead: "Chloe Anderson",
  },
  "bangkok-restoration-centre": {
    clinicDirector: "Somchai Prasert",
    leadSurgeon: "Dr. Ananya Srisai",
    seniorConsultant: "Nattaya Wong",
    consultant: "Kittisak Boonma",
    leadNurse: "Siriporn Chai",
    technician: "Pongpat Meesuk",
    receptionLead: "Wanida Thongchai",
  },
  "athens-medical-institute": {
    clinicDirector: "Eleni Papadopoulos",
    leadSurgeon: "Dr. Nikos Stavros",
    seniorConsultant: "Maria Konstantinou",
    consultant: "Andreas Dimitriou",
    leadNurse: "Ioanna Georgiou",
    technician: "Christos Alexiou",
    receptionLead: "Sofia Nikolaidou",
  },
  "los-angeles-hair-institute": {
    clinicDirector: "Madison Carter",
    leadSurgeon: "Dr. David Chen",
    seniorConsultant: "Jordan Williams",
    consultant: "Taylor Brooks",
    leadNurse: "Ashley Rivera",
    technician: "Michael Thompson",
    receptionLead: "Rachel Martinez",
  },
  "mumbai-hair-sciences": {
    clinicDirector: "Anjali Desai",
    leadSurgeon: "Dr. Rohit Kapoor",
    seniorConsultant: "Priya Menon",
    consultant: "Arjun Mehta",
    leadNurse: "Kavita Iyer",
    technician: "Vikram Singh",
    receptionLead: "Neha Joshi",
  },
  "sao-paulo-hair-institute": {
    clinicDirector: "Camila Ferreira",
    leadSurgeon: "Dr. Rafael Oliveira",
    seniorConsultant: "Lucas Santos",
    consultant: "Beatriz Almeida",
    leadNurse: "Fernanda Costa",
    technician: "Diego Rocha",
    receptionLead: "Mariana Lima",
  },
};

export function buildEnterpriseDemoStaffEmail(key: string): string {
  const local = key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  return `titan.${local}@${ENTERPRISE_DEMO_STAFF_EMAIL_DOMAIN}`;
}

function resolveReportsToKey(
  clinicSlug: string,
  reportsToSuffix: string | "global-ops-director"
): string {
  if (reportsToSuffix === "global-ops-director") return "global-ops-director";
  return `${clinicSlug}-${reportsToSuffix}`;
}

/**
 * Pure generator for the IHRG enterprise franchise staff hierarchy.
 * Global leadership plus a seven-role clinic template replicated across all demo clinics.
 */
export function buildEnterpriseDemoStaffHierarchy(): EnterpriseDemoStaffHierarchyNode[] {
  const nodes: EnterpriseDemoStaffHierarchyNode[] = [];
  let colorIndex = 0;

  for (const leader of GLOBAL_LEADERSHIP) {
    nodes.push({
      key: leader.key,
      fullName: leader.fullName,
      positionTypeCode: leader.positionTypeCode,
      staffRole: POSITION_TO_STAFF_ROLE[leader.positionTypeCode],
      positionTitle: leader.positionTitle,
      hierarchyScope: "global",
      hierarchyLevel: leader.hierarchyLevel,
      clinicSlug: null,
      reportsToKey: leader.reportsToKey,
      email: buildEnterpriseDemoStaffEmail(leader.key),
      calendarColor: CALENDAR_COLORS[colorIndex % CALENDAR_COLORS.length],
      defaultTimezone: "UTC",
    });
    colorIndex += 1;
  }

  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const names = CLINIC_STAFF_NAMES[clinic.slug];
    if (!names) {
      throw new Error(`Missing clinic staff name pool for slug "${clinic.slug}".`);
    }

    for (const role of CLINIC_STAFF_TEMPLATE) {
      const key = `${clinic.slug}-${role.suffix}`;
      nodes.push({
        key,
        fullName: names[role.roleKey],
        positionTypeCode: role.positionTypeCode,
        staffRole: POSITION_TO_STAFF_ROLE[role.positionTypeCode],
        positionTitle: role.positionTitle,
        hierarchyScope: "clinic",
        hierarchyLevel: role.hierarchyLevel,
        clinicSlug: clinic.slug,
        reportsToKey: resolveReportsToKey(clinic.slug, role.reportsToSuffix),
        email: buildEnterpriseDemoStaffEmail(key),
        calendarColor: CALENDAR_COLORS[colorIndex % CALENDAR_COLORS.length],
        defaultTimezone: clinic.timezone,
      });
      colorIndex += 1;
    }
  }

  return nodes;
}

export function validateEnterpriseDemoStaffHierarchy(
  nodes: EnterpriseDemoStaffHierarchyNode[]
): { ok: true } | { ok: false; reason: string } {
  const keys = new Set(nodes.map((n) => n.key));
  if (keys.size !== nodes.length) {
    return { ok: false, reason: "Duplicate demo staff keys detected." };
  }

  for (const node of nodes) {
    if (node.reportsToKey && !keys.has(node.reportsToKey)) {
      return {
        ok: false,
        reason: `Staff "${node.key}" reports to missing key "${node.reportsToKey}".`,
      };
    }
  }

  const clinicSlugs = new Set(ENTERPRISE_DEMO_CLINICS.map((c) => c.slug));
  for (const slug of clinicSlugs) {
    const clinicNodes = nodes.filter((n) => n.clinicSlug === slug);
    if (clinicNodes.length !== CLINIC_STAFF_TEMPLATE.length) {
      return {
        ok: false,
        reason: `Clinic "${slug}" expected ${CLINIC_STAFF_TEMPLATE.length} staff nodes.`,
      };
    }
  }

  if (nodes.filter((n) => n.hierarchyScope === "global").length !== GLOBAL_LEADERSHIP.length) {
    return { ok: false, reason: "Unexpected global leadership count." };
  }

  return { ok: true };
}
