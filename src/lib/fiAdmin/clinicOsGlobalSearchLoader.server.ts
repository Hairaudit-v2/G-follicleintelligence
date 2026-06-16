import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { attachSearchPattern, parseCrmLeadListQuery } from "@/src/lib/crm/crmLeadListQuery";
import { loadCrmLeadsShellPage } from "@/src/lib/crm/leadList";
import { escapeIlikePattern, searchFoundationRecords } from "@/src/lib/fi/foundation/search";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { ClinicOsGlobalSearchCase, ClinicOsGlobalSearchLead, ClinicOsGlobalSearchPatient, ClinicOsGlobalSearchPayload } from "./clinicOsGlobalSearchTypes";

function patientEmailPhoneFromSubtitle(subtitle: string): { email: string | null; phone: string | null } {
  const s = subtitle.trim();
  if (!s) return { email: null, phone: null };
  const parts = s.split(" · ").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { email: null, phone: null };
  if (parts.length === 1) {
    const p = parts[0];
    if (p.includes("@")) return { email: p, phone: null };
    return { email: null, phone: p };
  }
  const email = parts.find((p) => p.includes("@")) ?? null;
  const phone = parts.find((p) => !p.includes("@")) ?? null;
  return { email, phone };
}

async function enrichCaseRows(
  tenantId: string,
  caseIds: string[]
): Promise<Map<string, { externalId: string | null; patientName: string; status: string }>> {
  const out = new Map<string, { externalId: string | null; patientName: string; status: string }>();
  if (caseIds.length === 0) return out;
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const { data: viewRows, error: vErr } = await supabase
    .from("v_fi_case_foundation")
    .select("case_id, foundation_patient_id, status")
    .eq("tenant_id", tid)
    .in("case_id", caseIds);
  if (vErr) throw new Error(vErr.message);

  const fpIds = Array.from(
    new Set(
      (viewRows ?? [])
        .map((r) => (r as { foundation_patient_id: string | null }).foundation_patient_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const nameByFp = new Map<string, string>();
  if (fpIds.length > 0) {
    const { data: pr, error: pErr } = await supabase
      .from("v_fi_patient_resolution")
      .select("foundation_patient_id, display_name")
      .eq("tenant_id", tid)
      .in("foundation_patient_id", fpIds);
    if (pErr) throw new Error(pErr.message);
    for (const row of pr ?? []) {
      const fp = (row as { foundation_patient_id: string | null }).foundation_patient_id;
      if (!fp) continue;
      const dn = (row as { display_name: string | null }).display_name?.trim();
      nameByFp.set(fp, dn || "Patient");
    }
  }

  const { data: extRows, error: eErr } = await supabase
    .from("fi_cases")
    .select("id, external_id")
    .eq("tenant_id", tid)
    .is("deleted_at", null)
    .in("id", caseIds);
  if (eErr) throw new Error(eErr.message);
  const extByCase = new Map<string, string | null>();
  for (const row of extRows ?? []) {
    extByCase.set(String((row as { id: string }).id), (row as { external_id: string | null }).external_id ?? null);
  }

  for (const row of viewRows ?? []) {
    const caseId = String((row as { case_id: string }).case_id);
    const fp = (row as { foundation_patient_id: string | null }).foundation_patient_id;
    const status = String((row as { status: string }).status ?? "");
    const patientName = fp ? nameByFp.get(fp) ?? "—" : "—";
    out.set(caseId, {
      externalId: extByCase.get(caseId) ?? null,
      patientName,
      status,
    });
  }

  return out;
}

/**
 * Read-only Clinic OS command palette search (patients + cases via foundation search;
 * leads via existing CRM shell RPC when CRM nav is allowed).
 */
export async function loadClinicOsGlobalSearchResults(tenantId: string, queryRaw: string): Promise<ClinicOsGlobalSearchPayload> {
  const tid = tenantId.trim();
  const query = queryRaw.trim().slice(0, 120);
  if (!query) {
    return { patients: [], cases: [], leads: [] };
  }

  const patientOsSearchAllowed = await getBookingsBoardNavAllowed(tid);

  const [caseBlock, patientBlock] = await Promise.all([
    searchFoundationRecords({ tenantId: tid, query, type: "cases", limit: 12 }),
    patientOsSearchAllowed
      ? searchFoundationRecords({ tenantId: tid, query, type: "patients", limit: 12 })
      : Promise.resolve(null),
  ]);

  const patients: ClinicOsGlobalSearchPatient[] =
    patientBlock?.patients.map((hit) => {
      const { email, phone } = patientEmailPhoneFromSubtitle(hit.subtitle);
      return {
        id: hit.id,
        name: hit.title,
        email,
        phone,
        href: hit.href,
      };
    }) ?? [];

  const caseHits = caseBlock.cases;
  const caseIds = caseHits.map((h) => h.id);
  const enrich = await enrichCaseRows(tid, caseIds);

  const cases: ClinicOsGlobalSearchCase[] = caseHits.map((hit) => {
    const row = enrich.get(hit.id);
    const externalId = row?.externalId?.trim() ?? null;
    const caseNumber = externalId || `Case ${hit.id.slice(0, 8)}…`;
    return {
      id: hit.id,
      caseNumber,
      patientName: row?.patientName ?? "—",
      status: row?.status ?? "—",
      href: hit.href,
    };
  });

  const showCrmNav = await getCrmShellNavAllowed(tid);
  if (!showCrmNav) {
    return { patients, cases, leads: [] };
  }

  const sp = new URLSearchParams();
  sp.set("search", query);
  sp.set("page", "1");
  sp.set("pageSize", "10");
  let parsed = parseCrmLeadListQuery(sp);
  const esc = escapeIlikePattern(parsed.searchRaw.trim());
  parsed = attachSearchPattern(parsed, esc.length ? esc : null);

  const leadPage = await loadCrmLeadsShellPage(tid, parsed);
  const leads: ClinicOsGlobalSearchLead[] = leadPage.items.map((item) => ({
    id: item.lead.id,
    name: leadTitleFromRow(item.lead.summary, item.lead.id),
    stageLabel: item.stage?.label?.trim() || "—",
    href: `/fi-admin/${tid}/crm/leads/${item.lead.id}`,
  }));

  return { patients, cases, leads };
}
