import type { SupabaseClient } from "@supabase/supabase-js";

/** Non-active (closed) CRM lead statuses — aligned with FI OS operational dashboards. */
const TERMINAL_LEAD_STATUSES = new Set(["archived", "lost", "converted"]);

export type TimelyLeadResolutionStatus = "matched" | "none" | "ambiguous";

export type TimelyLeadResolutionMeta = {
  status: TimelyLeadResolutionStatus;
  checked_at: string;
};

export type ResolveTimelyBookingLeadInput = {
  tenant_id: string;
  patient_id?: string | null;
  person_id?: string | null;
};

export type ResolveTimelyBookingLeadResult = {
  lead_id: string | null;
  timely_lead_resolution: TimelyLeadResolutionMeta;
};

function isActiveCrmLeadStatus(status: string | null | undefined): boolean {
  return !TERMINAL_LEAD_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

/**
 * Resolve an FI CRM lead for a Timely booking when the person already has a commercial journey.
 * Does not create leads or write to HubSpot.
 */
export async function resolveTimelyBookingLead(
  supabase: SupabaseClient,
  input: ResolveTimelyBookingLeadInput
): Promise<ResolveTimelyBookingLeadResult> {
  const checked_at = new Date().toISOString();
  const personId = input.person_id?.trim();

  if (!personId) {
    return {
      lead_id: null,
      timely_lead_resolution: { status: "none", checked_at },
    };
  }

  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, status, updated_at, created_at")
    .eq("tenant_id", input.tenant_id.trim())
    .eq("person_id", personId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const active = (data ?? []).filter((row) =>
    isActiveCrmLeadStatus((row as { status: string }).status)
  );

  if (active.length === 0) {
    return {
      lead_id: null,
      timely_lead_resolution: { status: "none", checked_at },
    };
  }

  if (active.length === 1) {
    return {
      lead_id: String((active[0] as { id: string }).id),
      timely_lead_resolution: { status: "matched", checked_at },
    };
  }

  const leadIds = active.map((row) => String((row as { id: string }).id));
  console.warn(
    `[timely-lead-resolution] ambiguous active CRM leads for tenant=${input.tenant_id.trim()} person=${personId}: ${leadIds.join(", ")}`
  );

  return {
    lead_id: null,
    timely_lead_resolution: { status: "ambiguous", checked_at },
  };
}
