/** Default GL accounts + multi-clinic P&L pure helpers (Stage 7). */

export type GlAccountType = "revenue" | "expense" | "asset" | "liability" | "equity" | "cogs";

export type DefaultGlAccountSeed = {
  code: string;
  name: string;
  account_type: GlAccountType;
  sort_order: number;
  /** Expense category codes that map to this GL account by default. */
  category_codes: readonly string[];
};

export const DEFAULT_GL_ACCOUNT_SEEDS: readonly DefaultGlAccountSeed[] = [
  {
    code: "4000",
    name: "Patient revenue (collections)",
    account_type: "revenue",
    sort_order: 10,
    category_codes: [],
  },
  {
    code: "5000",
    name: "Cost of clinical supplies",
    account_type: "cogs",
    sort_order: 20,
    category_codes: ["clinical_consumables", "medications"],
  },
  {
    code: "6100",
    name: "Marketing expense",
    account_type: "expense",
    sort_order: 30,
    category_codes: ["marketing_ads", "marketing_other"],
  },
  {
    code: "6200",
    name: "Staff & contractors",
    account_type: "expense",
    sort_order: 40,
    category_codes: ["staff_contractors"],
  },
  {
    code: "6300",
    name: "Facilities & rent",
    account_type: "expense",
    sort_order: 50,
    category_codes: ["facilities"],
  },
  {
    code: "6400",
    name: "Software & SaaS",
    account_type: "expense",
    sort_order: 60,
    category_codes: ["software_saas"],
  },
  {
    code: "6500",
    name: "Equipment",
    account_type: "expense",
    sort_order: 70,
    category_codes: ["equipment"],
  },
  {
    code: "6600",
    name: "Travel",
    account_type: "expense",
    sort_order: 80,
    category_codes: ["travel"],
  },
  {
    code: "6700",
    name: "Professional services",
    account_type: "expense",
    sort_order: 90,
    category_codes: ["professional_services"],
  },
  {
    code: "6800",
    name: "Bank & merchant fees",
    account_type: "expense",
    sort_order: 100,
    category_codes: ["bank_fees"],
  },
  {
    code: "6900",
    name: "Other operating expense",
    account_type: "expense",
    sort_order: 900,
    category_codes: ["other"],
  },
] as const;

export type ClinicPlLine = {
  clinic_id: string | null;
  clinic_name: string;
  revenue_collected_cents: number;
  opex_net_cents: number;
  net_operating_cents: number;
};

export type ClinicPlSummary = {
  period_start: string;
  period_end: string;
  by_clinic: ClinicPlLine[];
  unallocated: ClinicPlLine;
  totals: ClinicPlLine;
};

export type ClinicPlLedgerInput = {
  clinic_id: string | null;
  transaction_kind: string;
  direction: string;
  amount_cents: number;
  created_at: string;
};

const REVENUE_KINDS = new Set(["payment_received", "deposit_paid", "balance_paid"]);

function inIsoRange(iso: string, start: string, end: string): boolean {
  const d = iso.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

/**
 * Multi-clinic operating P&L from ledger rows (same economics as Stage 6, split by clinic_id).
 */
export function aggregateMultiClinicOperatingPl(input: {
  period_start: string;
  period_end: string;
  ledger: readonly ClinicPlLedgerInput[];
  clinicNames: ReadonlyMap<string, string>;
}): ClinicPlSummary {
  const period_start = input.period_start.slice(0, 10);
  const period_end = input.period_end.slice(0, 10);

  type Acc = { revenue: number; opex_posted: number; opex_void: number };
  const by = new Map<string, Acc>();

  const keyOf = (clinicId: string | null) => clinicId?.trim() || "__none__";

  for (const row of input.ledger) {
    if (!inIsoRange(row.created_at, period_start, period_end)) continue;
    const amount = Math.max(0, Math.floor(row.amount_cents));
    const k = keyOf(row.clinic_id);
    const acc = by.get(k) ?? { revenue: 0, opex_posted: 0, opex_void: 0 };
    const kind = String(row.transaction_kind);
    const dir = String(row.direction);
    if (REVENUE_KINDS.has(kind) && dir === "credit") acc.revenue += amount;
    if (kind === "expense_posted" && dir === "debit") acc.opex_posted += amount;
    if (kind === "expense_void_reversal" && dir === "credit") acc.opex_void += amount;
    by.set(k, acc);
  }

  const toLine = (clinic_id: string | null, acc: Acc): ClinicPlLine => {
    const opex_net_cents = Math.max(0, acc.opex_posted - acc.opex_void);
    const name =
      clinic_id == null
        ? "Unallocated"
        : input.clinicNames.get(clinic_id)?.trim() || clinic_id.slice(0, 8);
    return {
      clinic_id,
      clinic_name: name,
      revenue_collected_cents: acc.revenue,
      opex_net_cents,
      net_operating_cents: acc.revenue - opex_net_cents,
    };
  };

  const unallocatedAcc = by.get("__none__") ?? { revenue: 0, opex_posted: 0, opex_void: 0 };
  const unallocated = toLine(null, unallocatedAcc);

  const by_clinic: ClinicPlLine[] = [];
  let totalRev = 0;
  let totalOpex = 0;
  for (const [k, acc] of by) {
    if (k === "__none__") continue;
    const line = toLine(k, acc);
    by_clinic.push(line);
    totalRev += line.revenue_collected_cents;
    totalOpex += line.opex_net_cents;
  }
  by_clinic.sort((a, b) => a.clinic_name.localeCompare(b.clinic_name));

  totalRev += unallocated.revenue_collected_cents;
  totalOpex += unallocated.opex_net_cents;

  return {
    period_start,
    period_end,
    by_clinic,
    unallocated,
    totals: {
      clinic_id: null,
      clinic_name: "All clinics",
      revenue_collected_cents: totalRev,
      opex_net_cents: totalOpex,
      net_operating_cents: totalRev - totalOpex,
    },
  };
}

export function defaultGlCodeForCategoryCode(categoryCode: string | null | undefined): string {
  const code = (categoryCode ?? "").trim().toLowerCase();
  for (const seed of DEFAULT_GL_ACCOUNT_SEEDS) {
    if (seed.category_codes.includes(code)) return seed.code;
  }
  return "6900";
}
