import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { attachSearchPattern, parseCrmLeadListQuery } from "@/src/lib/crm/crmLeadListQuery";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { loadCrmLeadsShellPage } from "@/src/lib/crm/leadList";
import { escapeIlikePattern, searchFoundationRecords } from "@/src/lib/fi/foundation/search";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";

const MAX = 20;

export type ConsultationLinkSearchPatientHit = {
  id: string;
  person_id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type ConsultationLinkSearchLeadHit = {
  id: string;
  person_id: string;
  name: string;
  stageLabel: string;
  email: string | null;
  phone: string | null;
};

export type ConsultationLinkSearchPayload = {
  patients: ConsultationLinkSearchPatientHit[];
  leads: ConsultationLinkSearchLeadHit[];
};

function uuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

/**
 * Read-only patient + CRM lead search for ConsultationOS linking modals (max {@link MAX} each).
 */
export async function loadConsultationLinkSearchResults(
  tenantId: string,
  queryRaw: string
): Promise<ConsultationLinkSearchPayload> {
  const tid = tenantId.trim();
  const query = queryRaw.trim().slice(0, 120);
  if (!tid || !query) {
    return { patients: [], leads: [] };
  }

  const block = await searchFoundationRecords({
    tenantId: tid,
    query,
    type: "patients",
    limit: MAX,
  });
  const candidateIds: string[] = [];
  for (const h of block.patients) {
    if (h.warning?.includes("No foundation")) continue;
    if (!uuidLike(h.id)) continue;
    candidateIds.push(h.id);
  }
  const uniquePatientIds = Array.from(new Set(candidateIds)).slice(0, MAX);

  let patients: ConsultationLinkSearchPatientHit[] = [];
  if (uniquePatientIds.length > 0) {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("v_fi_patient_resolution")
      .select("foundation_patient_id, person_id, display_name, email, phone")
      .eq("tenant_id", tid)
      .in("foundation_patient_id", uniquePatientIds);
    if (error) throw new Error(error.message);
    const order = new Map(uniquePatientIds.map((id, i) => [id, i]));
    patients = (data ?? [])
      .map((raw) => {
        const r = raw as {
          foundation_patient_id: string | null;
          person_id: string | null;
          display_name: string | null;
          email: string | null;
          phone: string | null;
        };
        const fp = r.foundation_patient_id?.trim();
        const per = r.person_id?.trim();
        if (!fp || !per) return null;
        return {
          id: fp,
          person_id: per,
          name: r.display_name?.trim() || "Patient",
          email: r.email?.trim() || null,
          phone: r.phone?.trim() || null,
        } satisfies ConsultationLinkSearchPatientHit;
      })
      .filter((x): x is ConsultationLinkSearchPatientHit => x != null)
      .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
      .slice(0, MAX);
  }

  let leads: ConsultationLinkSearchLeadHit[] = [];
  if (await getCrmShellNavAllowed(tid)) {
    const sp = new URLSearchParams();
    sp.set("search", query);
    sp.set("page", "1");
    sp.set("pageSize", String(MAX));
    let parsed = parseCrmLeadListQuery(sp);
    const esc = escapeIlikePattern(parsed.searchRaw.trim());
    parsed = attachSearchPattern(parsed, esc.length ? esc : null);
    const leadPage = await loadCrmLeadsShellPage(tid, parsed);
    leads = leadPage.items.slice(0, MAX).map((item) => {
      const meta = item.person?.metadata ?? {};
      const { email, phone } = displayFromPersonMetadata(meta as Record<string, unknown>);
      return {
        id: item.lead.id,
        person_id: item.lead.person_id,
        name: leadTitleFromRow(item.lead.summary, item.lead.id),
        stageLabel: item.stage?.label?.trim() || "—",
        email: email ?? null,
        phone: phone ?? null,
      };
    });
  }

  return { patients, leads };
}
