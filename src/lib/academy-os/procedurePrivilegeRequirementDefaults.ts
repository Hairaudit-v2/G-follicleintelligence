/**
 * Default procedure privilege requirements for tenant bootstrap.
 * Multiple rows per role = OR (any satisfies).
 */

import type { PrivilegeLevel } from "./procedurePrivilegeTypes";

export type DefaultProcedurePrivilegeRequirement = {
  event_type: string;
  assigned_role: string;
  required_procedure_key: string;
  minimum_privilege_level: PrivilegeLevel;
};

export const DEFAULT_PROCEDURE_PRIVILEGE_REQUIREMENTS: DefaultProcedurePrivilegeRequirement[] = [
  // surgery
  {
    event_type: "surgery",
    assigned_role: "surgeon",
    required_procedure_key: "hairline_design",
    minimum_privilege_level: "perform_independent",
  },
  {
    event_type: "surgery",
    assigned_role: "surgeon",
    required_procedure_key: "donor_assessment",
    minimum_privilege_level: "perform_independent",
  },
  {
    event_type: "surgery",
    assigned_role: "nurse",
    required_procedure_key: "theatre_setup",
    minimum_privilege_level: "assist",
  },
  {
    event_type: "surgery",
    assigned_role: "technician",
    required_procedure_key: "graft_sorting",
    minimum_privilege_level: "assist",
  },
  {
    event_type: "surgery",
    assigned_role: "consultant",
    required_procedure_key: "consultation",
    minimum_privilege_level: "perform_independent",
  },
  // prp
  {
    event_type: "prp",
    assigned_role: "doctor",
    required_procedure_key: "prp_assistance",
    minimum_privilege_level: "perform_independent",
  },
  {
    event_type: "prp",
    assigned_role: "nurse",
    required_procedure_key: "prp_assistance",
    minimum_privilege_level: "assist",
  },
  // exosomes
  {
    event_type: "exosomes",
    assigned_role: "doctor",
    required_procedure_key: "exosomes_assistance",
    minimum_privilege_level: "perform_independent",
  },
  {
    event_type: "exosomes",
    assigned_role: "nurse",
    required_procedure_key: "exosomes_assistance",
    minimum_privilege_level: "assist",
  },
  // consultation
  {
    event_type: "consultation",
    assigned_role: "consultant",
    required_procedure_key: "consultation",
    minimum_privilege_level: "perform_independent",
  },
  // theatre_day
  {
    event_type: "theatre_day",
    assigned_role: "nurse",
    required_procedure_key: "theatre_setup",
    minimum_privilege_level: "assist",
  },
  {
    event_type: "theatre_day",
    assigned_role: "technician",
    required_procedure_key: "graft_sorting",
    minimum_privilege_level: "assist",
  },
];

export type ProcedurePrivilegeRequirementSeedResult = {
  created: number;
  skipped: number;
};
