import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import type { HubspotContactParsedRow } from "./hubspotContactCsvColumns";
import type {
  HubspotContactsDryRunReport,
  HubspotContactRowValidation,
} from "./validateHubspotContactsImport";

const HUBSPOT_SOURCE = "hubspot";

export async function extendHubspotDryRunWithDatabase(
  tenantId: string,
  rows: HubspotContactParsedRow[],
  baseReport: HubspotContactsDryRunReport,
  client?: SupabaseClient
): Promise<HubspotContactsDryRunReport> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();
  const recordIds = Array.from(
    new Set(rows.map((r) => r.recordId?.trim()).filter(Boolean))
  ) as string[];

  const existingRecordIds = new Set<string>();
  if (recordIds.length) {
    const chunk = 200;
    for (let i = 0; i < recordIds.length; i += chunk) {
      const slice = recordIds.slice(i, i + chunk);
      const { data, error } = await supabase
        .from("fi_person_source_ids")
        .select("source_person_id")
        .eq("tenant_id", tid)
        .eq("source_system", HUBSPOT_SOURCE)
        .in("source_person_id", slice);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        existingRecordIds.add(String((row as { source_person_id: string }).source_person_id));
      }
    }
  }

  const emails = Array.from(
    new Set(rows.map((r) => normalizeEmail(r.email)).filter(Boolean))
  ) as string[];
  const emailToPersonId = new Map<string, string>();
  if (emails.length) {
    const { data: persons, error: pe } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tid);
    if (pe) throw new Error(pe.message);
    for (const p of persons ?? []) {
      const row = p as { id: string; metadata: unknown };
      const m = row.metadata as Record<string, unknown> | null;
      const en =
        typeof m?.email_normalized === "string" ? m.email_normalized.trim().toLowerCase() : null;
      if (en && emails.includes(en)) {
        emailToPersonId.set(en, row.id);
      }
      const hub = m?.hubspot as Record<string, unknown> | undefined;
      const he = typeof hub?.email === "string" ? normalizeEmail(hub.email) : null;
      if (he && emails.includes(he)) {
        emailToPersonId.set(he, row.id);
      }
    }
  }

  const rowResults: HubspotContactRowValidation[] = baseReport.rowResults.map((rr) => {
    const rid = rr.recordId;
    const extra: typeof rr.issues = [];
    if (rid && existingRecordIds.has(rid)) {
      extra.push({
        code: "hubspot_record_already_imported",
        message: "This HubSpot Record ID already exists in fi_person_source_ids.",
        blocking: true,
      });
    }
    const row = rows.find((r) => r.rowIndex === rr.rowIndex);
    const em = row ? normalizeEmail(row.email) : null;
    if (em && rid) {
      const pid = emailToPersonId.get(em);
      if (pid) {
        void pid;
        extra.push({
          code: "email_exists_in_fi",
          message: "Email already exists on another fi_persons row; import may skip or conflict.",
          blocking: false,
        });
      }
    }
    return { ...rr, issues: [...rr.issues, ...extra] };
  });

  let blockingCount = 0;
  let warningCount = 0;
  for (const rr of rowResults) {
    for (const i of rr.issues) {
      if (i.blocking) blockingCount++;
      else warningCount++;
    }
  }
  const passed = !rowResults.some((r) => r.issues.some((i) => i.blocking));

  return {
    ...baseReport,
    rowResults,
    blockingCount,
    warningCount,
    passed,
  };
}

export async function hubspotRecordIdExists(
  tenantId: string,
  recordId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_person_source_ids")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("source_system", HUBSPOT_SOURCE)
    .eq("source_person_id", recordId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
