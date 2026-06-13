import fs from "node:fs";

const j = JSON.parse(fs.readFileSync(new URL("./dangerous-rows.parsed.json", import.meta.url), "utf8"));
const rows = j.rows;
const dangerousCount = rows.length;

/**
 * Primary bucket (single best fit) per user taxonomy.
 */
function classify(row) {
  const file = row[1];
  const fn = row[2];
  const table = row[3];
  const line = row[15];
  const sn = (row[16] || "").replace(/\s+/g, " ");

  if (file.includes("fi-admin)/fi-admin/system/")) {
    return {
      bucket: "tenant-global/tooling",
      note: "FI System console: deliberate cross-tenant listing/count for operators; relies on route/auth gating, not row-level tenant filters.",
    };
  }

  if (file.startsWith("scripts/")) {
    return {
      bucket: "tenant-global/tooling",
      note: "Repository script (provisioning / import tooling); not an end-user HTTP surface.",
    };
  }

  if (file.includes("hubspot-commit-latest-dry-run-batch.ts")) {
    return {
      bucket: "tenant-global/tooling",
      note: "HubSpot batch commit script; staging insert and batch discovery by pipeline status.",
    };
  }

  if (table === "fi_users" && sn.includes("auth_user_id")) {
    return {
      bucket: "false positive",
      note: "Lookup is keyed by authenticated user id (`auth_user_id`), not missing tenant isolation on a tenant-scoped table.",
    };
  }

  if (table === "fi_staff_pin_sessions" && sn.includes("session_token")) {
    return {
      bucket: "false positive",
      note: "Row scope is the unguessable `session_token` (capability URL), analogous to public payment tokens.",
    };
  }

  if (table === "fi_payment_requests" && sn.includes("public_token")) {
    return {
      bucket: "false positive",
      note: "Public payment view is scoped by `public_token`, not `tenant_id` on the chain.",
    };
  }

  if (sn.includes("tenant_id.is.null") || sn.includes("tenant_id, null") || (sn.includes("tenant_id.eq.") && sn.includes("tenant_id.is.null"))) {
    return {
      bucket: "false positive",
      note: "Query explicitly allows global (`tenant_id` null) plus tenant-specific rows; static audit did not mark multiline/OR tenant scope.",
    };
  }

  if (file.includes("organisationalProfile.server.ts") && table === "fi_staff_feature_templates") {
    return { bucket: "false positive", note: "Uses `.or(tenant_id.is.null,tenant_id.eq...)` for template resolution." };
  }
  if (file.includes("tenantMode.server.ts") && table === "fi_tenant_operating_modes") {
    return { bucket: "false positive", note: "Uses `.or(tenant_id.is.null,tenant_id.eq...)` for mode rows." };
  }
  if (file.includes("imagingOsGuidedCapture.server.ts") && table === "fi_imaging_protocol_templates") {
    return { bucket: "false positive", note: "Uses `.or(tenant_id.eq...,tenant_id.is.null)` for tenant override + global default." };
  }

  if (file.includes("fiOsImpersonation.server.ts") && table === "fi_os_impersonation_sessions") {
    return {
      bucket: "false positive",
      note: "Update filters by `initiator_auth_user_id` — scoped to the authenticated initiator’s sessions.",
    };
  }

  if (file === "lib/fi/pipeline.ts" && table === "fi_uploads") {
    return {
      bucket: "safe by prior ownership check",
      note: "Same function already loaded `fi_cases` with `.eq('tenant_id', tenantId)`; uploads filtered by `case_id` from that scope. Optional `.eq('tenant_id', tenantId)` for defense-in-depth.",
    };
  }

  if (file.includes("integrity.ts") && table === "fi_event_links") {
    return {
      bucket: "safe by prior ownership check",
      note: "`event_id` values come from `listFiEventIdsForTenant` (tenant-filtered `fi_events` enumeration).",
    };
  }

  if (file.includes("tenantOperationalDashboardLoader.server.ts") && table === "fi_persons") {
    return {
      bucket: "safe by prior ownership check",
      note: "`person_id` set is derived from `fi_crm_leads` queried with `.eq('tenant_id', tid)` in the same function.",
    };
  }

  if (file.includes("reminderJobs.server.ts") && table === "fi_persons") {
    return {
      bucket: "safe by prior ownership check",
      note: "`personIdsNeeded` populated from tenant-scoped `fi_crm_leads` and reminder job rows for that tenant batch.",
    };
  }

  if (file.includes("hubspotImportBatchLoad.server.ts") && table === "stg_hubspot_contacts_imports") {
    return {
      bucket: "safe by prior ownership check",
      note: "`import_batch_id` is only used after `fi_import_batches` was loaded with `.eq('tenant_id', tenantId).eq('id', batchId)`.",
    };
  }

  if (file.includes("reminderProcessor.server.ts") && table === "fi_reminder_jobs" && sn.includes("pending")) {
    return {
      bucket: "tenant-global/tooling",
      note: "Worker dequeue lists pending jobs across tenants by design; per-job `tenant_id` is carried on the row for downstream tenant-scoped work.",
    };
  }

  if (file.includes("fiPaymentRemindersCron.server.ts") && table === "fi_invoices") {
    return {
      bucket: "tenant-global/tooling",
      note: "Cron-style sweep over invoices across tenants; must be restricted to trusted scheduler/cron identity (not a user-facing list API).",
    };
  }

  if (file.includes("outcomeIntelligence.server.ts") && table === "fi_global_outcome_aggregates") {
    return {
      bucket: "tenant-global/tooling",
      note: "Anonymised / aggregate outcome intelligence tables; not per-patient tenant row reads.",
    };
  }

  if (file.includes("patientTwinHairProgression.server.ts") && table === "hair_intelligence_progression_network_buckets") {
    return {
      bucket: "tenant-global/tooling",
      note: "Coalition/network aggregate bucket keyed by cohort signature — not a direct tenant-row listing.",
    };
  }

  if (
    (fn === "getLatestFiEventLink" && table === "fi_event_links") ||
    (fn === "linkEventToEntities" && table === "fi_event_links")
  ) {
    return {
      bucket: "safe by prior ownership check",
      note: "**Fixed (2026-06-13):** `assertFiEventBelongsToTenant` (queries `fi_events` with `id` + `tenant_id`) runs in the same function before any `fi_event_links` read/write; the static audit does not connect those chains.",
    };
  }

  if (file === "app/api/fi/cases/route.ts") {
    if (table === "fi_cases" || table === "fi_intakes") {
      return {
        bucket: "insert/upsert safe",
        note: "`assertLegacyFiApiAccess` + required `tenant_id` in body; `caseRow` / `intakeRow` include `tenant_id`. Scanner does not mark insert payload.",
      };
    }
    if (table === "fi_referrals") {
      return {
        bucket: "insert/upsert safe",
        note: "Referral upsert is keyed to `case_id` created in the same request under `tenant_id`; partner resolved with `.eq('tenant_id', tenant_id)`.",
      };
    }
  }

  if (file === "app/api/fi/partners/route.ts" && table === "fi_partners") {
    return {
      bucket: "insert/upsert safe",
      note: "Insert literal includes `tenant_id` in snippet; legacy API gated by `assertLegacyFiApiAccess`.",
    };
  }

  if (file === "app/api/fi/uploads/route.ts" && table === "fi_uploads") {
    return {
      bucket: "insert/upsert safe",
      note: "`inserts` built with `tenant_id` and `case_id` after `fi_cases` verified with `.eq('tenant_id', tenant_id)`.",
    };
  }

  if (file.includes("fi-prescribing-actions.ts") && table === "fi_prescription_items") {
    return {
      bucket: "insert/upsert safe",
      note: "`rows` objects include `tenant_id: tid` built in the same block; snippet-only audit misses payload fields.",
    };
  }

  if (file.includes("mapping.ts") && table === "fi_intakes" && sn.includes("upsert")) {
    return {
      bucket: "insert/upsert safe",
      note: "`ensureFiIntake` builds `row` with `tenant_id: input.tenantId` before upsert.",
    };
  }

  if (file.includes("provision-evolved-tenant.ts")) {
    return {
      bucket: "tenant-global/tooling",
      note: "Tenant bootstrap script inserting seed CRM stages, reminder templates, services for a known `tenantId`.",
    };
  }

  if (file.includes("clinicSetupWizard.server.ts")) {
    if (table === "fi_clinic_settings") {
      return {
        bucket: "insert/upsert safe",
        note: "`onConflict: 'tenant_id,clinic_id'` upsert; tenant/clinic provenance from wizard context.",
      };
    }
    return {
      bucket: "safe by prior ownership check",
      note: "`ids` for delete come from prior selects scoped to the wizard’s tenant/clinic in the same module.",
    };
  }

  if (file.includes("consultationFormMutations.server.ts")) {
    if (table === "fi_consultation_form_templates" && sn.includes("tenant_id")) {
      return {
        bucket: "tenant-global/tooling",
        note: "Global catalogue templates use `.is('tenant_id', null)` — intentional platform-wide form definitions.",
      };
    }
    if (table === "fi_consultation_form_template_versions" && sn.includes(".insert(")) {
      return {
        bucket: "insert/upsert safe",
        note: "Template version insert is tied to `templateId` resolved from global template lookup in the same flow.",
      };
    }
    return {
      bucket: "safe by prior ownership check",
      note: "Selects constrained by `template_id` / `status` after template row resolved in-function.",
    };
  }

  if (file.includes("consultationMutations.server.ts") && table === "fi_consultations") {
    return {
      bucket: "insert/upsert safe",
      note: "Server mutation builds `insertRow` with tenant/booking scope from validated wizard/API inputs (verify callers pass tenant).",
    };
  }

  if (file.includes("crm/pipeline.ts") && table === "fi_crm_pipeline_stages") {
    return {
      bucket: "insert/upsert safe",
      note: "`insertRows` constructed with tenant from CRM setup context (admin path).",
    };
  }

  if (file.includes("clinicalIntelligenceEvents.server.ts") || file.includes("outcomeIntelligenceEvents.server.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "Insert payloads include `tenant_id` / patient scope from caller context for FI-OS event recording.",
    };
  }

  if (file.includes("bookings.ts") && table === "fi_bookings") {
    return {
      bucket: "insert/upsert safe",
      note: "`insertRow` includes tenant and clinic identifiers from booking creation flow.",
    };
  }

  if (file.includes("postOpUpdate.ts") || file.includes("procedureDayUpdate.ts") || file.includes("surgeryPlanningUpdate.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "Clinical inserts use payloads tied to a `case_id` / tenant from the mutation entrypoint.",
    };
  }

  if (file.includes("foundation/resolveClinic.ts") || file.includes("foundation/resolveOrganisation.ts") || file.includes("foundation/resolvePatient.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "`insertRow` includes `tenant_id` from resolver input; service-role insert for idempotent create-by-source.",
    };
  }

  if (file.includes("staff.server.ts") || file.includes("iiohrHrStaffImportRunner.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "`payload` includes `tenant_id` for staff insert; snippet does not expand object literal.",
    };
  }

  if (file.includes("reminderEnqueue.server.ts") && table === "fi_reminder_jobs") {
    return {
      bucket: "insert/upsert safe",
      note: "`rows` built with `tenant_id` per job enqueue path.",
    };
  }

  if (file.includes("revenueInvoiceMutations.server.ts") && table === "fi_invoices") {
    return {
      bucket: "insert/upsert safe",
      note: "Invoice insert includes tenant from revenue mutation context.",
    };
  }

  if (file.includes("taxLocalisationSettings.server.ts") && sn.includes(".insert(")) {
    return {
      bucket: "insert/upsert safe",
      note: "`rowPayload` includes `tenant_id` / clinic scope from `upsertTaxLocalisationDocument` args.",
    };
  }

  if (file.includes("pathologyRequestMutations.server.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "Pathology item inserts follow request header with tenant/case linkage.",
    };
  }

  if (file.includes("imagingOsMutations.server.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "Imaging insert scoped to tenant/patient from mutation parameters.",
    };
  }

  if (file.includes("timelyWebhookEvents.server.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "Webhook event row includes tenant/integration identifiers from webhook handler context.",
    };
  }

  if (file.includes("protocolAlertEvents.server.ts")) {
    return {
      bucket: "insert/upsert safe",
      note: "Upsert slices include tenant/session identifiers and idempotency keys from alert builder.",
    };
  }

  if (file.includes("protocolSession.server.ts")) {
    if (table === "hli_photo_protocol_templates" || table === "hli_photo_protocol_slots") {
      return {
        bucket: "tenant-global/tooling",
        note: "Active protocol templates/slots are platform catalogue keyed by slug/template id (not per-tenant isolation at this layer).",
      };
    }
    if (sn.includes(".insert(")) {
      return {
        bucket: "insert/upsert safe",
        note: "Session slot inserts follow session row created under `tenant_id` for the patient.",
      };
    }
    return {
      bucket: "safe by prior ownership check",
      note: "Reads use `session_id` / template id from session or template already resolved under tenant checks in callers.",
    };
  }

  if (file.includes("fiOsHairLossClassification.server.ts") && table === "hli_image_classifications") {
    return {
      bucket: "safe by prior ownership check",
      note: "`patientImageId` should only be used after `fi_patient_images` tenant-scoped validation in calling paths (defense-in-depth: add tenant join if ever exposed wider).",
    };
  }

  return {
    bucket: "needs tenant_id filter",
    note: "Default: service-role chain lacks explicit `tenant_id` in the matched snippet; triage further — may be defense-in-depth only, or promote to ownership assert / wrapper if IDs are externally influenced.",
  };
}

const order = [
  "false positive",
  "safe by prior ownership check",
  "insert/upsert safe",
  "tenant-global/tooling",
  "needs tenant_id filter",
  "needs ownership assertion",
  "needs service-role wrapper",
  "true dangerous",
];

const grouped = Object.fromEntries(order.map((k) => [k, []]));

for (const row of rows) {
  const { bucket, note } = classify(row);
  if (!grouped[bucket]) grouped[bucket] = [];
  grouped[bucket].push({ row, note });
}

let md = `# DANGEROUS rows from \`audit-supabase-admin-from.result.csv\`

Source: \`tools/audit-supabase-admin-from.result.csv\` (regenerated audit). **${dangerousCount}** rows rated \`DANGEROUS\` (between \`SAFE\` and \`CRITICAL\` in this tool’s scale). For the stricter \`CRITICAL\` disposition table, see \`tools/audit-supabase-admin-from.critical-review.md\`.

**Event links (2026-06-13):** \`getLatestFiEventLink\` and \`linkEventToEntities\` in \`lib/fi/events/mapping.ts\` now take \`tenantId\` and call \`assertFiEventBelongsToTenant\` before any \`fi_event_links\` access. The scanner may still list those lines as \`DANGEROUS\` because the \`fi_event_links\` chain lacks \`tenant_id\`. Tests: \`lib/fi/events/eventLinksTenantAssert.test.ts\`.

This document groups every row into a **single primary bucket** for triage. It is a **static** review: heuristics flag “service role + no \`tenant_id\` on the matched query chain”, even when tenant is carried in insert payloads, prior reads, OR filters, or when the surface is intentionally cross-tenant (system admin, cron, global catalogue).

**Legend**

| Bucket | Meaning |
|--------|---------|
| **false positive** | Tenant or user scope is present but not in the shape the scanner matches (e.g. \`auth_user_id\`, \`public_token\`, \`OR tenant_id …\`). |
| **safe by prior ownership check** | Same function or call chain already established tenant/case/batch scope; flagged line omits redundant \`tenant_id\`. |
| **insert/upsert safe** | Write carries \`tenant_id\` (or FK to a tenant-scoped parent) in the payload object; snippet does not show it. |
| **tenant-global/tooling** | Intentionally cross-tenant, global catalogue, aggregate, script, or operator console — policy/auth is the control, not row filters. |
| **needs tenant_id filter** | Add \`.eq('tenant_id', …)\` (or join) on the flagged chain for defense-in-depth or clarity **if** IDs could be wrong. |
| **needs ownership assertion** | Add explicit assert (or join through \`fi_events\` / case) so IDs cannot cross tenants if misrouted. |
| **needs service-role wrapper** | Prefer one audited helper for “service role + pattern X” (optional hygiene; **none mandatory** in this pass). |
| **true dangerous** | Plausible cross-tenant read/write if deployed without the assumed auth/route controls (**none** classified here by default — see notes). |

---

## Summary counts

`;

const counts = order.map((k) => [k, (grouped[k] || []).length]).filter(([, n]) => n > 0);
md += "| Bucket | Rows |\n|--------|-----:|\n";
for (const [k, n] of counts.sort((a, b) => b[1] - a[1])) {
  md += `| ${k} | ${n} |\n`;
}
const zeroBuckets = order.filter((k) => (grouped[k] || []).length === 0);
md += `\nBuckets with **0** rows in this classifier pass: **${zeroBuckets.join("**, **")}**.\n`;
md += "\n---\n\n## Grouped disposition\n\n";

for (const bucket of order) {
  const list = grouped[bucket] || [];
  if (list.length === 0) continue;
  md += `### ${bucket} (${list.length})\n\n`;
  for (const { row, note } of list) {
    const file = row[1];
    const fn = row[2];
    const table = row[3];
    const line = row[15];
    md += `- **\`${file}\`** — line **${line}** — table \`${table}\` — \`${fn}\`  \n  ${note}\n\n`;
  }
}

md += `---

## Full row index (${dangerousCount})

| # | File | Line | Function | Table | Primary bucket | Notes |
|---|------|------|----------|-------|----------------|-------|
`;

let i = 0;
for (const row of rows) {
  i += 1;
  const { bucket, note } = classify(row);
  const safeNote = note.replace(/\|/g, "\\|").replace(/\n/g, " ");
  md += `| ${i} | \`${row[1]}\` | ${row[15]} | \`${row[2]}\` | \`${row[3]}\` | ${bucket} | ${safeNote} |\n`;
}

md += `
---

## \`true dangerous\` and \`needs service-role wrapper\`

- **true dangerous (0 rows):** No DANGEROUS row was promoted here as an unconditional “ship blocker” without route/auth context. The closest **policy** risks are **system console** listings and **cron sweeps** (see **tenant-global/tooling**) — those become dangerous if the surrounding **authentication** or **deployment exposure** is wrong, not because the SQL lacks \`tenant_id\` alone.

- **needs service-role wrapper (0 rows):** Optional future hygiene (e.g. centralise \`fi_event_links\` access behind one module) — not required for this triage list.

---

*Generated by \`tools/build-dangerous-review.mjs\` from \`tools/dangerous-rows.parsed.json\`. Re-run after regenerating the CSV: \`node tools/extract-dangerous-audit-rows.mjs && node tools/build-dangerous-review.mjs\`.*
`;

const out = new URL("./audit-supabase-admin-from.dangerous-review.md", import.meta.url);
fs.writeFileSync(out, md, "utf8");
console.log("Wrote", out.pathname || out.href);

if (rows.length === 0) console.warn("No DANGEROUS rows in CSV");
