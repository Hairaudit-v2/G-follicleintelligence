# Ecosystem architecture stabilization audit

**Sprint:** Architecture Stabilization Sprint  
**Scope:** Cross-system integration inventory for **FI OS**, **HairAudit**, **IIOHR**, and **HLI (Hair Longevity Institute)** as implemented or documented in this repository. Read-only analysis; no runtime behavior was changed for this document.

**Goal:** Surface coupling, duplication, and identity/versioning risks before migrating new event/export code onto the shared `packages/intelligence-core` boundary (Stage 10).

---

## 1. System map (four active systems)

| System | Role in this repo | Primary touchpoints |
|--------|-------------------|---------------------|
| **FI OS** | Clinic operating system (CRM, calendar, consultation, imaging, revenue, patient twin, outcome intelligence) | Next.js app, Supabase RLS, `lib/` + `src/lib/` |
| **HairAudit** | Independent audit / AuditOS-aligned flows | Producer events (`hairaudit.*`), OS gates (`fi_auditor`), design docs |
| **IIOHR** | Academy / certification; HR staff feed → FI | Staff sync webhook/cron, staff source metadata |
| **HLI** | Diagnostics, longevity pathways, intake/labs/imaging (design + producer events) | Producer events (`hli.*`), design vocabulary |

External product databases for HairAudit and HLI are **not** in this repo; integration is **push**-oriented (events, webhooks) per `docs/design/01-platform-architecture.md`.

---

## 2. Event emitters and ingestion (FI as consumer)

### 2.1 Producer FI events (`fi_events`)

| Item | Location / notes |
|------|------------------|
| **HTTP ingress** | `POST /api/fi/events` → `app/api/fi/events/route.ts` → `ingestFiEvent` (`lib/fi/events/ingest.ts`) |
| **Auth / env gate** | `assertLegacyFiApiAccess` (`src/lib/fiOs/legacyFiApiAuth.ts`); production requires `FI_LEGACY_FI_API_ENABLED` + long `FI_LEGACY_FI_API_SECRET` (see `src/lib/env/fiEnv.server.ts`) |
| **Envelope types** | `FiEventEnvelope`, `FiSourceSystem`, `FiEventType` in `src/types/fi-events.ts` |
| **Runtime schema** | `parseFiEventEnvelope` / payloads in `lib/fi/events/schema.ts` (**authoritative** allow-list) |
| **Design vocabulary (wider)** | `src/lib/fi/vocabulary.ts` lists additional event names **not** all accepted by ingest — drift risk vs `schema.ts` |
| **Handlers** | `lib/fi/events/handlers/*` (HLI intake/document, HairAudit case/images, clinic stub) |
| **Downstream chains** | `maybeSubmitCaseFromEvent`, `maybeTriggerPipelineFromEvent` (`lib/fi/events/trigger.ts`) — **tight coupling** from ingest to case pipeline |
| **Foundation dual-write** | `dualWriteFoundationFromFiEvent` (`src/lib/fi/foundation/dualWriteEvent.ts`) — timeline, patients, cases, media links |

**Accepted `event_type` today (ingest):** `hli.intake.submitted`, `hli.document.uploaded`, `hairaudit.case.submitted`, `hairaudit.images.uploaded`, `clinic.ai.usage`.

**Accepted `source_system` today:** `hli`, `hairaudit`, `clinic` (must match `event_type` per schema).

**Current event chains (simplified):**

1. **HLI intake:** `hli.intake.submitted` → handler → `fi_events` + links → dual-write foundation → (optional) submit case path.  
2. **HLI document:** `hli.document.uploaded` → storage-backed handler → dual-write → may trigger pipeline when case non-draft.  
3. **HairAudit case:** `hairaudit.case.submitted` → handler → `fi_events` + global case resolution → dual-write.  
4. **HairAudit images:** `hairaudit.images.uploaded` → handler → dual-write → pipeline triggers when readiness met.  

**Gap vs intelligence-core draft:** Draft envelope uses `IntelligenceSystemSource` (`fi_os`, `hli`, `hairaudit`, `iiohr`, `external`) and additional event names (e.g. `iiohr.competency.*`, `fi_os.patient_twin.updated`). Today’s FI ingest still uses the legacy wire value **`clinic`** (mapped to `fi_os` in adapters only). There is **no** new `iiohr` producer path on this API in Stage 10 — **taxonomy is aligned in documentation and adapter tests**, not by changing ingress.

**Stage 10 taxonomy:** See [ecosystem-source-system-taxonomy.md](./ecosystem-source-system-taxonomy.md) for the authoritative `clinic` ↔ `fi_os` mapping and reserved systems.

---

## 3. Webhook senders and receivers

| Direction | Route / module | Purpose |
|-----------|----------------|---------|
| **Inbound (Timely / Zapier)** | `app/api/tenants/[tenantId]/integrations/timely/patient|appointment|discovery` | Bearer `FI_TIMELY_WEBHOOK_SECRET`; discovery → `fi_integration_webhook_events` |
| **Inbound (IIOHR HR)** | `app/api/tenants/[tenantId]/integrations/iiohr-hr/staff-sync` | `x-iiohr-sync-secret` vs `IIOHR_HR_SYNC_SECRET`; staff rows → FI staff tables |
| **Inbound (cron)** | `app/api/cron/iiohr-hr-perth-staff-sync` | Orchestrates Perth HR feed fetch + staff sync |
| **Inbound (Stripe)** | `app/api/fi-payments/stripe/webhook` | Payment events → `fi_payment_webhook_events` |
| **Inbound (FI legacy producers)** | `POST /api/fi/events` | HLI / HairAudit / clinic envelope |
| **Outbound** | Pharmacy / reminders / future callbacks | See `lib/actions/fi-pharmacy-transmission-actions.ts`, reminder jobs; no unified “intelligence bus” outbound yet |

**Observation:** Multiple parallel webhook patterns (Bearer, custom headers, Stripe signatures). **No single middleware contract** for correlation IDs, privacy labels, or replay — duplicated policy surface.

---

## 4. Export / import helpers and replay

| Area | Location | Notes |
|------|----------|-------|
| **Foundation replay** | `backfillFoundationFromProcessedEventsAction` (`lib/actions/fi-actions.ts`), `backfillFoundation.ts` | Replays dual-write from processed `fi_events` — **replay exists for foundation, not for a generic intelligence bus** |
| **Scripts** | `scripts/replay-test.ts`, `scripts/replay-job-lock-test.ts` | Idempotency / job locking experiments |
| **HubSpot import** | `lib/actions/fi-hubspot-crm-import-actions.ts`, CLI `hubspot:*` scripts | CRM bulk import; rollback plan scripts |
| **IIOHR HR import** | `scripts/import-iiohr-hr-staff.ts`, `src/lib/staffImport/*` | Operational staff data |

**IIOHR competency export/replay** (academy ledger → FI) is described in product strategy but **not** located as a single module in this repo — **contract duplication risk** when implemented in multiple places without `intelligence-core/contracts`.

---

## 5. Graph builders and intelligence surfaces

| Surface | Location | Cross-system notes |
|---------|----------|--------------------|
| **Staff intelligence** | `src/lib/fi-os/staffIntelligence*.ts`, workspace composers | Uses HR metadata, roles, compliance — **IIOHR snapshot** in `staffTwinLoader.server.ts` (read-only, not SoR) |
| **Organisational / clinical intelligence** | `src/lib/fi-os/*`, `src/config/fiOrganisationalIntelligenceRegistry.ts` | Aggregates FI-native signals; references HairAudit / IIOHR as **feature flags** (`src/lib/systemStatus/systemFeatureRegistry.ts`) |
| **Patient Twin / hair intelligence** | `src/lib/patientTwin/*`, `src/lib/hair-intelligence/*` | HLI/HairAudit-compatible `source_system` in some alert paths (e.g. photo protocol alerts) |
| **Outcome intelligence** | `src/lib/fi-os/outcomeIntelligence*` | Stage 6 tests; not a separate graph DB |

**Risk:** Graph-like outputs are **embedded in FI OS** modules without a shared **privacy-tiered payload** contract — easy to leak PHI into “analytics” shapes unless exports go through `intelligence-core/policy` + contracts.

---

## 6. Evidence writers and manifests

| Concept | Location | Notes |
|---------|----------|-------|
| **FI event evidence** | `fi_events`, `fi_event_links` | Append-only producer log |
| **Webhook inbox** | `fi_integration_webhook_events` | Raw JSON for integrations |
| **HairAudit case payload** | Ingest payloads (`HairAuditCaseSubmittedPayload`) | Demographics in payload — **PII on wire** for legitimate clinical sync; must stay out of **graph/export** contracts |
| **Design: evidence manifests** | Architecture / AuditOS docs (marketing + design) | No single `EvidenceManifestV1` implementation in app code — **schema drift** until shared contract adopted |

---

## 7. Shadow snapshot systems

| Mechanism | Description |
|-----------|-------------|
| **`fi_staff_source_ids.metadata`** | IIOHR / Academy snapshot embedded in staff mapping (see `staffTwinLoader.server.ts`) — **shadow read model** |
| **HR feed JSON** | `loadEvolvedPerthHrStaffSnapshot.server.ts` — external SoR is IIOHR HR portal |
| **Universal patient / case resolution** | `v_fi_patient_resolution`, global IDs | Legacy + foundation overlap (documented in `docs/design/` and `PROJECT_OVERVIEW.md`) |

---

## 8. Identity helpers

| Mechanism | Location | Risk |
|-----------|----------|------|
| **Producer identifiers** | `FiEventEnvelope.identifiers` (`source_patient_id`, `source_case_id`, …) | Multiple string namespaces without a single **global ID** type per domain |
| **Foundation vs global** | `fi_global_cases`, `fi_patients`, `fi_patient_source_ids` | **Dual lineage** — correct for migration, risky for new features without explicit `ProfessionalGlobalId` / `PatientGlobalId` discipline |
| **Tenant scope** | `tenant_id` on envelope | Good boundary; must stay mandatory on all intelligence events |

---

## 9. Policy and environment gates

| Gate | Variables / module |
|------|---------------------|
| Legacy FI API | `FI_LEGACY_FI_API_ENABLED`, `FI_LEGACY_FI_API_SECRET` |
| FI payments | `readFiPaymentsEnabled()` and related env (Stripe webhook) |
| HR sync | `IIOHR_HR_SYNC_SECRET`, feed URL/key, cron secrets |
| Timely | `FI_TIMELY_WEBHOOK_SECRET` |
| Feature registry | `systemFeatureRegistry`, `fiFeatureAccessRegistry`, route guards |

**Risk:** Policy is **scattered** (per integration). `intelligence-core/policy` drafts a **unified decision shape**; enforcement remains application-side until Stage 10.

---

## 10. Observability, logs, and audit tables

| Table / area | Role |
|--------------|------|
| `fi_events` | Producer audit + idempotency (`source_event_id`) |
| `fi_integration_webhook_events` | Integration debug inbox |
| `fi_payment_webhook_events` | Stripe processing audit |
| `fi_staff_sync_runs` | IIOHR HR sync run log |
| CRM activity | `fi_crm_activity_events` — operational audit parallel to `fi_events` |

**Gap:** No standard **`IntelligenceEventLogRecord`** writer today — observability types in `intelligence-core` are forward-looking.

---

## 11. Direct coupling points (summary)

1. **Ingest handler → pipeline → models** in-process (no queue) — producer latency and failure modes bleed into HTTP response.  
2. **Vocabulary vs schema** — two sources of truth for “allowed” event names.  
3. **`source_system: clinic` vs product language “FI OS”** — naming mismatch for documentation and new producers.  
4. **IIOHR** integrated as **HR staff ETL**, not as competency ledger events — different coupling model than HairAudit/HLI.  
5. **HLI** partially represented in ingest + broader design doc list — **partial implementation** vs design.  
6. **Stripe / Timely / HubSpot** each own auth + persistence patterns — duplicated **security and audit** concerns.

---

## 12. Duplicated patterns

- Webhook authentication and “enabled” flags repeated per route family.  
- Append-only event tables with JSON payloads (good) but **no shared envelope** for correlation, privacy tier, or schema version across all integrations.  
- Global / foundation / source-id resolution logic spread across handlers and `dualWriteEvent`.

---

## 13. Identity risks

- New code may invent **ad hoc string IDs** instead of reusing `fi_global_*` or foundation IDs.  
- Pseudonymous analytics IDs are **not** standardized in app code — `intelligence-core/identity` defines stubs and migration intent only.

---

## 14. Schema and versioning risks

- Producer payloads evolve **without** a declared `schema_version` on the envelope (today).  
- Design docs allow more `event_type` values than `schema.ts` — onboarding confusion and producer breakage.  
- Shared **V1 contracts** in `intelligence-core` are additive documentation; they do not yet gate runtime.

---

## 15. Privacy and export risks

- HLI intake and HairAudit case payloads include **direct identifiers** by design for clinical operations — acceptable for secured ingest, **unacceptable** for professional graph export without redaction.  
- HubSpot / CRM paths handle commercial PII — separate from HairAudit but part of the same deployment.  
- **Mitigation:** Guardrails doc + policy default `exportMode: disabled`; graph contracts stay minimal and non-PHI.

---

## 16. Recommended package boundaries (`packages/intelligence-core`)

| Folder | Responsibility |
|--------|----------------|
| `events/` | Envelope, event names, delivery mode, privacy level, validation helpers |
| `identity/` | Global ID type aliases + pseudonymous ID stubs (document migration from app helpers) |
| `contracts/` | Versioned boundary DTOs (V1) for competency, audit, readiness, outcome, HLI diagnostics |
| `policy/` | Decision types + defaults (no enforcement until wired) |
| `observability/` | Log/export/replay/health record shapes |

**Apps (FI OS monolith today):** Import from `@follicle/intelligence-core` only for **new** code paths in Stage 10; legacy `FiEventEnvelope` remains until a deliberate bridge layer exists.

---

## 17. Recommended migration order (post-audit)

1. **Freeze vocabulary drift:** align `src/lib/fi/vocabulary.ts` comments with `lib/fi/events/schema.ts` or generate allow-list from one source.  
2. **Adopt intelligence-core types in docs and OpenAPI** (if any) before code.  
3. **New outbound/cross-system features:** emit through a single internal “bus” module that uses `IntelligenceEventEnvelope` (non-blocking, audited).  
4. **IIOHR competency / replay:** implement against `contracts/*` + `events/*` only; no ad hoc JSON.  
5. **HLI longevity / lab pathways:** map to `HliLongevitySignalV1` and explicit event names before widening ingest.  
6. **Deprecate `clinic` source label** in favor of `fi_os` in **new** producers, with backward compatibility shim in parse layer (Stage 10+).

---

## 18. Stage 10 implementation plan (after this sprint)

1. **Bridge types:** Map existing `FiEventEnvelope` ↔ `IntelligenceEventEnvelope` in a thin adapter (no handler rewrite).  
2. **New events only:** Any new `event_type` or producer (`iiohr`, `fi_os`) is declared in `intelligence-core` first, then mirrored into `schema.ts`.  
3. **Exports:** All export APIs return `IntelligenceExportPolicyDecision` defaulting to disabled; explicit env promotion to `dev_only` / `allowed`.  
4. **Observability:** For each new cross-system write, append `IntelligenceEventLogRecord` or `IntelligenceExportAttempt` to a dedicated table (migration **after** policy review — not in this sprint).  
5. **Graph payloads:** Enforce `IntelligenceEventPrivacyLevel` + contract validation at build time (TypeScript) and optionally Zod at runtime.  
6. **Tests:** Extend `verify-fi-event-ingestion` script to accept golden fixtures from `intelligence-core` test vectors.  
7. **HLI:** When adding lab/diagnostics events, register under `hli.*` namespace and add minimal `HliLongevitySignalV1` fields to contracts before UI exposure.

---

## 19. Files created or owned by this sprint (reference)

- `docs/ecosystem-architecture-stabilization-audit.md` (this file)  
- `docs/ecosystem-integration-guardrails.md`  
- `packages/intelligence-core/**` (scaffold, types, README)

No database migrations or auth changes were made as part of this documentation and scaffold deliverable.
