import "server-only";

import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { attachSearchPattern, parseCrmLeadListQuery } from "@/src/lib/crm/crmLeadListQuery";
import { loadCrmLeadsShellPage } from "@/src/lib/crm/leadList";
import { escapeIlikePattern, searchFoundationRecords } from "@/src/lib/fi/foundation/search";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import {
  beginFiPerfCollection,
  finishFiPerfCollection,
  recordFiPerfPayloadBytes,
  withFiPerfSpan,
} from "@/src/lib/performance/fiPerfCollector.server";
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

function mapLeadItems(
  tenantId: string,
  items: Awaited<ReturnType<typeof loadCrmLeadsShellPage>>["items"]
): ClinicOsGlobalSearchLead[] {
  return items.map((item) => ({
    id: item.lead.id,
    name: leadTitleFromRow(item.lead.summary, item.lead.id),
    stageLabel: item.stage?.label?.trim() || "—",
    href: `/fi-admin/${tenantId}/crm/leads/${item.lead.id}`,
  }));
}

/**
 * CRM leads only — secondary fetch after first-pass patients/cases paint.
 */
export async function loadClinicOsGlobalSearchLeads(
  tenantId: string,
  queryRaw: string
): Promise<ClinicOsGlobalSearchLead[]> {
  const tid = tenantId.trim();
  const query = queryRaw.trim().slice(0, 120);
  if (!query) return [];
  if (!(await getCrmShellNavAllowed(tid))) return [];

  const sp = new URLSearchParams();
  sp.set("search", query);
  sp.set("page", "1");
  sp.set("pageSize", String(GLOBAL_SEARCH_RESULT_LIMIT));
  let parsed = parseCrmLeadListQuery(sp);
  const esc = escapeIlikePattern(parsed.searchRaw.trim());
  parsed = attachSearchPattern(parsed, esc.length ? esc : null);

  const leadPage = await loadCrmLeadsShellPage(tid, parsed);
  return mapLeadItems(tid, leadPage.items);
}

/**
 * Read-only Clinic OS command palette search (patients + cases via foundation search;
 * leads optional — defer to {@link loadClinicOsGlobalSearchLeads} for first-paint budget).
 */
export async function loadClinicOsGlobalSearchResults(
  tenantId: string,
  queryRaw: string,
  opts?: { includeLeads?: boolean }
): Promise<ClinicOsGlobalSearchPayload> {
  const tid = tenantId.trim();
  const query = queryRaw.trim().slice(0, 120);
  if (!query) {
    return { patients: [], cases: [], leads: [] };
  }

  const includeLeads = opts?.includeLeads === true;
  beginFiPerfCollection("clinic_os_global_search", tid);

  try {
    const navChecks = withFiPerfSpan("nav.permissions", () =>
      Promise.all([getBookingsBoardNavAllowed(tid), getCrmShellNavAllowed(tid)])
    );
    const casesPromise = withFiPerfSpan("search.cases", () =>
      searchFoundationRecords({
        tenantId: tid,
        query,
        type: "cases",
        limit: GLOBAL_SEARCH_RESULT_LIMIT,
      })
    );

    const [[patientOsSearchAllowed, showCrmNav], caseBlock] = await Promise.all([
      navChecks,
      casesPromise,
    ]);

    const patientBlock = patientOsSearchAllowed
      ? await withFiPerfSpan("search.patients", () =>
          searchFoundationRecords({
            tenantId: tid,
            query,
            type: "patients",
            limit: GLOBAL_SEARCH_RESULT_LIMIT,
          })
        )
      : null;

    let leads: ClinicOsGlobalSearchLead[] = [];
    if (includeLeads && showCrmNav) {
      leads = await withFiPerfSpan("search.leads", () => loadClinicOsGlobalSearchLeads(tid, query));
    }

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

    const payload = { patients, cases, leads };
    recordFiPerfPayloadBytes(JSON.stringify(payload).length);
    return payload;
  } finally {
    finishFiPerfCollection();
  }
}