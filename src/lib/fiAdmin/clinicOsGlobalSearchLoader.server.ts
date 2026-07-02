import "server-only";

import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { attachSearchPattern, parseCrmLeadListQuery } from "@/src/lib/crm/crmLeadListQuery";
import { loadCrmLeadsShellPage } from "@/src/lib/crm/leadList";
import { escapeIlikePattern, searchFoundationRecords } from "@/src/lib/fi/foundation/search";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type {
  ClinicOsGlobalSearchCase,
  ClinicOsGlobalSearchLead,
  ClinicOsGlobalSearchPatient,
  ClinicOsGlobalSearchPayload,
} from "./clinicOsGlobalSearchTypes";

const GLOBAL_SEARCH_RESULT_LIMIT = 6;

function patientEmailPhoneFromSubtitle(subtitle: string): {
  email: string | null;
  phone: string | null;
} {
  const s = subtitle.trim();
  if (!s) return { email: null, phone: null };
  const parts = s
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
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

function caseFromFoundationSearchHit(hit: {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}): ClinicOsGlobalSearchCase {
  const parts = hit.subtitle
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  const status = parts[0] ?? "—";
  const externalId = parts.length >= 4 ? (parts[parts.length - 1] ?? null) : null;
  const caseNumber = externalId?.trim() || `Case ${hit.id.slice(0, 8)}…`;
  return {
    id: hit.id,
    caseNumber,
    patientName: "—",
    status,
    href: hit.href,
  };
}

/**
 * Read-only Clinic OS command palette search (patients + cases via foundation search;
 * leads via existing CRM shell RPC when CRM nav is allowed).
 */
export async function loadClinicOsGlobalSearchResults(
  tenantId: string,
  queryRaw: string
): Promise<ClinicOsGlobalSearchPayload> {
  const tid = tenantId.trim();
  const query = queryRaw.trim().slice(0, 120);
  if (!query) {
    return { patients: [], cases: [], leads: [] };
  }

  const navChecks = Promise.all([getBookingsBoardNavAllowed(tid), getCrmShellNavAllowed(tid)]);
  const casesPromise = searchFoundationRecords({
    tenantId: tid,
    query,
    type: "cases",
    limit: GLOBAL_SEARCH_RESULT_LIMIT,
  });

  const [[patientOsSearchAllowed, showCrmNav], caseBlock] = await Promise.all([
    navChecks,
    casesPromise,
  ]);

  const sp = new URLSearchParams();
  sp.set("search", query);
  sp.set("page", "1");
  sp.set("pageSize", String(GLOBAL_SEARCH_RESULT_LIMIT));
  let parsed = parseCrmLeadListQuery(sp);
  const esc = escapeIlikePattern(parsed.searchRaw.trim());
  parsed = attachSearchPattern(parsed, esc.length ? esc : null);

  const [patientBlock, leadPage] = await Promise.all([
    patientOsSearchAllowed
      ? searchFoundationRecords({
          tenantId: tid,
          query,
          type: "patients",
          limit: GLOBAL_SEARCH_RESULT_LIMIT,
        })
      : Promise.resolve(null),
    showCrmNav ? loadCrmLeadsShellPage(tid, parsed) : Promise.resolve({ items: [] }),
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

  const cases: ClinicOsGlobalSearchCase[] = caseBlock.cases.map(caseFromFoundationSearchHit);

  const leads: ClinicOsGlobalSearchLead[] = leadPage.items.map((item) => ({
    id: item.lead.id,
    name: leadTitleFromRow(item.lead.summary, item.lead.id),
    stageLabel: item.stage?.label?.trim() || "—",
    href: `/fi-admin/${tid}/crm/leads/${item.lead.id}`,
  }));

  return { patients, cases, leads };
}