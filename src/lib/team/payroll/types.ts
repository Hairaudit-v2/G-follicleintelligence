/**
 * Team payroll identity projection (FI-TEAM-COHESION-B1.8A).
 * Identity identifies the person; payroll records determine the money.
 * Wage rates / payable hours stay in protected wage/timesheet DTOs.
 */

import type {
  StaffEmploymentStatus,
  StaffIdentity,
  StaffIdentityIntegrity,
} from "@/src/lib/team/identity/types";

export type PayrollIdentityAttentionReason =
  | "identity_link_incomplete"
  | "scheduling_record_missing"
  | "lifecycle_record_missing"
  | "identity_requires_reconciliation"
  | "cross_tenant_mismatch"
  | "identity_invalid"
  | "missing_wage_profile"
  | "employment_ended"
  | "historical_attribution_only";

/**
 * Presentation pay basis — maps existing wage rate types without inventing rates.
 * `daily` wage profiles surface as `salary` (day-rate / salaried presentation).
 */
export type PayrollPayBasis = "hourly" | "salary" | "contractor" | "unknown";

export type PayrollStaffIdentitySummary = {
  personId: string;
  staffId: string | null;
  staffMemberId: string | null;
  userId: string | null;
  displayName: string;
  integrity: StaffIdentityIntegrity;
};

/**
 * Payroll-specific staff row. Does not expose base rates or gross costs.
 */
export type PayrollStaffEntry = {
  identity: PayrollStaffIdentitySummary;

  employment: {
    status: StaffEmploymentStatus;
    startDate: string | null;
    endDate: string | null;
  };

  payroll: {
    payrollProfileId: string | null;
    wageRecordId: string | null;
    payBasis: PayrollPayBasis;
    payrollReady: boolean;
  };

  attentionReasons: PayrollIdentityAttentionReason[];

  actions: {
    canEditPayrollProfile: boolean;
    canApproveTimesheet: boolean;
    canResolveIdentity: boolean;
  };
};

export const PAYROLL_IDENTITY_ATTENTION_LABELS: Record<
  PayrollIdentityAttentionReason,
  string
> = {
  identity_link_incomplete: "Identity link incomplete",
  scheduling_record_missing: "Scheduling record missing",
  lifecycle_record_missing: "Lifecycle record missing",
  identity_requires_reconciliation: "Identity requires reconciliation",
  cross_tenant_mismatch: "Cross-tenant identity mismatch",
  identity_invalid: "Identity invalid",
  missing_wage_profile: "Missing wage profile",
  employment_ended: "Employment ended",
  historical_attribution_only: "Historical cost attribution only",
};

/** Discriminated resolve input — no silent ID-type fallback. */
export type LoadPayrollStaffIdentityInput =
  | {
      tenantId: string;
      by: "staffMemberId";
      staffMemberId: string;
    }
  | {
      tenantId: string;
      by: "staffId";
      staffId: string;
    };

export type PayrollWageProjectionFacts = {
  wageProfileId: string | null;
  rateType: "hourly" | "daily" | "contractor" | null;
  employmentStartDate?: string | null;
  employmentEndDate?: string | null;
  /** True when this person only appears for historical cost attribution. */
  historicalAttributionOnly?: boolean;
  canEditPayrollProfile?: boolean;
  canApproveTimesheet?: boolean;
};

export type PayrollAuditIdentityRef = {
  personKey: string;
  staffId: string | null;
  staffMemberId: string | null;
  linkStatus: StaffIdentity["integrity"]["linkStatus"];
};

/**
 * Behaviour-neutral KPI source snapshot for B1.8A proofs.
 * Definitions must not change without a separate KPI ticket.
 */
export const PAYROLL_IDENTITY_KPI_SOURCE_SNAPSHOT = {
  totalRosteredLabourCost: {
    currentSource: "shiftCostIntelligence / computeSurgeryDayStaffingCost",
    canonicalReplacement: "unchanged financial engines; identity batch for attribution keys",
    definitionChanges: false,
  },
  totalApprovedHours: {
    currentSource: "aggregatePayPeriodStaffTotals minutesWorked for approved entries",
    canonicalReplacement: "unchanged timesheet approval math",
    definitionChanges: false,
  },
  unpaidOrMissingTimesheetCount: {
    currentSource: "punch sync soft failures / draft timesheet counts",
    canonicalReplacement: "unchanged punch→timesheet sync",
    definitionChanges: false,
  },
  staffWithoutPayrollSetup: {
    currentSource: "listActiveStaffForWageProfiles.hasWageProfile === false",
    canonicalReplacement: "PayrollStaffEntry.payroll.payrollReady === false",
    definitionChanges: false,
  },
  salaryHourlyContractorCounts: {
    currentSource: "countWageProfilesByRateType (hourly|daily|contractor)",
    canonicalReplacement: "unchanged rate-type counts; presentation alias daily→salary",
    definitionChanges: false,
  },
  payrollAttentionTotals: {
    currentSource: "missing wage profile + identity integrity reasons",
    canonicalReplacement: "PayrollStaffEntry.attentionReasons",
    definitionChanges: false,
  },
} as const;
