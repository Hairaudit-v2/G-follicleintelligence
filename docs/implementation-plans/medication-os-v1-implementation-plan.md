# MedicationOS v1 — implementation plan

**Status:** Planning only — no implementation in this document.  
**Sources:** [MedicationOS v1 design](../design/medication-os-v1.md), [DoctorOS 1A prescribing](../design/doctoros-1a-prescribing.md), [Patient timeline unification audit](../audits/patient-timeline-unification.md).

**Priorities (v1):** therapy plans → therapy events → patient timeline visibility → surgery post-op medication bundle → pathology monitoring flags.

---

## 1. Migration order

Migrations must respect FK dependencies and keep DoctorOS prescribing online throughout.

| Order | Migration focus | Depends on |
|------:|-----------------|------------|
| **M1** | `fi_medication_os_canonical` — reference rows, indexes, optional FK to `fi_medication_catalogue` | Existing `fi_tenants`, `fi_medication_catalogue` |
| **M2** | `fi_patient_therapy_plans` — patient/case/consultation/surgery plan anchors | `fi_patients`, optional `fi_cases`, `fi_consultations`, `fi_case_surgery_plans` |
| **M3** | `fi_patient_therapy_plan_items` — plan lines, `pathology_gate`, optional `prescription_id` | M2; nullable FK to `fi_patient_prescriptions` / items as per design |
| **M4** | `fi_patient_therapy_events` — append-only audit stream | M2–M3; nullable links to pathology, prescriptions, consultations |
| **M5** | `fi_postop_protocol_templates` *(optional within v1)* — defer to v1.1 if bundled JSON on plan `metadata` suffices | M2 only if shipped |
| **M6** | RLS policies + grants (see §11) | After tables exist |
| **M7** | Seed / bootstrap job for canonical rows per tenant (or copy global defaults) | M1 |

**Rule:** No migration may alter or drop DoctorOS prescribing tables (§3). New tables only until explicitly approved for column additions on `fi_consultations` / `fi_case_surgery_plans` metadata (prefer JSON metadata first).

---

## 2. Tables to create first

**First wave (blocking everything else):**

1. **`fi_medication_os_canonical`** — stable vocabulary for plans, events, Twin, and rules; enables seeding and FK-lite references from items/events via `canonical_code` (denormalised) plus optional `catalogue_id`.

**Second wave (core product objects):**

2. **`fi_patient_therapy_plans`** — header for intent/regimen (`plan_type`, `status`, anchors, `source`).
3. **`fi_patient_therapy_plan_items`** — lines (dosing summary, offsets, `pathology_gate`, optional `prescription_id`).
4. **`fi_patient_therapy_events`** — append-only clinical log; **authoritative MedicationOS audit stream** per design.

**Third wave (surgery bundle UX):**

5. **`fi_postop_protocol_templates`** — only if v1 ships reusable bundles; otherwise encode template id + JSON in `fi_patient_therapy_plans.metadata` and cut M5 from v1 scope.

**Indexes (plan in same migrations as tables):**

- Events: `(tenant_id, patient_id, occurred_at DESC)`; `(tenant_id, plan_id)` where `plan_id` is frequent.
- Plans: `(tenant_id, patient_id, status)`; optional `(tenant_id, case_id)`.
- Items: `(tenant_id, plan_id, sort_order)`.

---

## 3. Existing DoctorOS prescribing tables to preserve

Per [doctoros-1a-prescribing.md](../design/doctoros-1a-prescribing.md), **do not replace or fork** the pharmacy workflow. Preserve as system of record:

| Table | Role |
|-------|------|
| **`fi_medication_catalogue`** | Tenant pricing / compound sections; MedicationOS may **reference** via `fi_medication_os_canonical.catalogue_id`. |
| **`fi_patient_prescriptions`** | Legal/pharmacy prescription header; plan items may set nullable **`prescription_id`** when fulfilled from a plan line. |
| **`fi_prescription_items`** | Line-level Rx; unchanged contract with prescribing actions. |
| **`fi_prescription_status_events`** | Append-only Rx status audit; MedicationOS does not duplicate this stream (see non-goals). |
| **`fi_medication_reorder_requests`** | Reorder portal (if present in deployment); out of v1 MedicationOS write path unless explicitly linking later. |

**Prescribing actions:** Continue to use `lib/actions/fi-prescribing-actions.ts` and `requireFiPrescribingActor`; MedicationOS mutations use separate server modules with appropriate tenancy/clinical guards.

---

## 4. TypeScript types needed

| Area | Types / enums (suggested location) |
|------|-----------------------------------|
| **Canonical** | `MedicationOsCanonicalRow`, `TherapyTrack` (`maintenance` \| `procedural` \| `post_operative`), seed DTOs. |
| **Plans** | `PatientTherapyPlanRow`, `PlanType`, `PlanStatus`, `PlanSource`; `PatientTherapyPlanItemRow`, `PlanItemRole` (`continuous` \| `taper` \| `course` \| `prn` \| …). |
| **Events** | `PatientTherapyEventRow`, `TherapyEventType` (aligned with DB CHECK list in design §4.4). |
| **Pathology gates** | `PathologyGateTag` (string union or const object) for `plan_items.pathology_gate`; evaluation result type for app-layer checks. |
| **Twin read model** | Extend `patientTwinTypes.ts` — `clinical.medications`, optional `clinical.therapy_events_preview` (bounded list DTOs). |
| **Timeline** | `event_kind` union for mirrored kinds (`therapy.plan_activated`, …) aligned with `fi_timeline_events` conventions; `detail` shape types for dedupe keys. |
| **API / actions** | Input types for create/activate plan, append event, instantiate post-op template; zod schemas if matching project patterns. |

Keep **dual-track** clarity in types: plan/event vs prescription (`prescription_id` optional on item and event).

---

## 5. Server loaders and actions needed

**Loaders (read paths):**

| Loader | Purpose |
|--------|---------|
| `loadMedicationOsCanonicalForTenant` | Active canonical rows (+ optional catalogue join for display). |
| `loadPatientTherapyPlansForPatient` / `ForCase` | Filter by `status`, date bounds; include items in one query or batched. |
| `loadPatientTherapyEventsForPatient` | Chronological append-only feed, capped (Twin preview, admin surfaces). |
| `loadActiveTherapyPlanSummary` | Denormalised “active items” for Twin and banners. |
| `loadPostopTemplatesForTenant` | If `fi_postop_protocol_templates` ships in v1. |

**Mutations / actions (write paths — tenant-scoped, auditable):**

| Operation | Notes |
|-----------|------|
| Upsert canonical (admin) | Optional v1; may seed only via migration/SQL. |
| Create / update **draft** plan | ConsultationOS bridge; no pharmacy side effects. |
| Activate / supersede / cancel plan | Writes plan row + **mandatory** `fi_patient_therapy_events` rows (`plan_activated`, etc.). |
| Add or update plan items | Validates `canonical_code` against canonical table or allow-list. |
| Append therapy event | Primary write path for clinical transitions (`therapy_started`, `session_completed`, …). |
| Instantiate **post-op protocol** | Creates plan + items from template; sets `surgery_anchor_date`. |
| Link plan item → prescription | After DoctorOS Rx created; sets `prescription_id` on item + optional mirror event. |

**Integration touchpoints (call sites, not necessarily new files):**

- Consultation completion / automation orchestrator (optional, feature-flagged): see §7.
- Surgery plan state transitions (scheduled/completed): see §8.
- Pathology result evaluation worker or inline after result save: see §9.
- Timeline dual-write helper (shared with foundation patterns): see §10.

---

## 6. Patient Twin integration

Per [medication-os-v1.md §10](../design/medication-os-v1.md) and [patient-timeline-unification.md](../audits/patient-timeline-unification.md):

1. **Extend `clinical.medications`** (today null): expose `active_plan_count`, `active_items[]` (`canonical_code`, display label, `role`, optional `next_review_at`, `postop_phase` derived from anchor).
2. **Add `clinical.therapy_events_preview`**: last **N** events (non-sensitive titles, `occurred_at`, `event_type`); cap strictly for payload size.
3. **Foundation timeline card** remains `fi_timeline_events` only — MedicationOS gains visibility on Twin **via mirrored timeline rows** (§10) plus structured clinical cards; do not conflate with Profile TL until unification decision is executed.
4. **Provenance:** add new tables to `SOURCE_TABLES_USED` in `patientTwinLoader.server.ts` when loaders query them.
5. **Pathology synergy:** optional cross-line in medications block referencing pathology section IDs when `pathology_gate` active (monitoring flags).

**Unification note:** Audit recommends choosing a canonical chronology; v1 **does not** merge Profile TL and Twin TL — only adds **foundation timeline** mirrors for high-signal therapy events (§10).

---

## 7. ConsultationOS integration

Per design §7 and [consultation-automation](../audits/consultation-automation-plan.md) pattern:

| Step | Implementation direction |
|------|-------------------------|
| **Trigger** | Optional post–`completeConsultationFormInstance` path or `runConsultationCompletionAutomation` sibling hook — **feature-flagged per tenant**. |
| **Behaviour** | Create `fi_patient_therapy_plans` with `status=draft`, `source=consultation_completion`, `consultation_id` set; items from `ConsultationCompletionSummary` (`recommendedTreatments`, outcome, structured data — rules TBD with clinical). |
| **Linkage** | Prefer `fi_consultations.structured_data.medication_plan_id` (or dedicated column in **later** migration once FK stable). |
| **CRM** | Optional `appendCrmActivityEvent` e.g. `therapy.plan_drafted_from_consultation` for operator visibility. |
| **Events** | Insert `fi_patient_therapy_events` (`plan_created`) in same transaction as plan insert when product requires strict audit. |

**Dependency:** therapy plans + items + events tables (M2–M4) before UI or automation wiring.

---

## 8. SurgeryOS post-op medication bundle integration

Per design §9:

| Step | Implementation direction |
|------|-------------------------|
| **Anchor** | Set `fi_patient_therapy_plans.surgery_plan_id` and `surgery_anchor_date` when surgery date is known (booking, manual entry, or `fi_case_surgery_plans`). |
| **Template apply** | On transition to **scheduled** or **completed** (exact state names to match existing case/surgery module), run **instantiate post-op template** → new `post_operative` plan + items with `day_offset_start` / `day_offset_end`. |
| **SurgeryOS UI** | Optional `fi_case_surgery_plans.metadata.active_therapy_plan_id` for tab deep-link; avoid heavy surgery plan migrations in v1 — metadata first. |
| **Procedural courses** | PRP/PRF lines: `sessions_planned` / `sessions_completed` driven by `session_completed` therapy events. |

**Priority:** post-op bundle instantiation is **high** for v1 product value; depends on M2–M4 and either template table or embedded JSON template.

---

## 9. Pathology monitoring integration

Per design §8:

| Concern | v1 approach |
|---------|-------------|
| **Gates** | Store declarative tag in `fi_patient_therapy_plan_items.pathology_gate` (e.g. `requires_normal_lft`); **evaluate in application layer** against latest `fi_pathology_results` / items (existing tables). |
| **Flags in Twin** | Surface “active gate” and last clearing context on `clinical.medications` / pathology cross-link. |
| **Audit** | On transition, append `fi_patient_therapy_events` (`pathology_gate_cleared`, `therapy_on_hold`) with `pathology_request_id` / `pathology_result_id` in row + `detail`. |
| **Rules table** | `fi_pathology_medication_rules` — **out of v1** (design non-goal); tags + code sufficient for v1. |

**Priority:** monitoring **flags** and gate evaluation hooks rank high; full rules engine deferred.

---

## 10. Timeline event integration

Per design §6 and timeline audit §5.4:

| Trigger | Suggested `event_kind` | `detail` keys (minimum) |
|---------|------------------------|-------------------------|
| Plan activated | `therapy.plan_activated` | `plan_id`, `plan_type`, `canonical_codes` |
| Maintenance started | `therapy.maintenance_started` | `plan_item_id`, `canonical_code` |
| Procedural session done | `therapy.procedure_session_completed` | `plan_item_id`, `session_index`, `canonical_code` |
| Post-op course done | `therapy.postop_protocol_completed` | `plan_id`, `surgery_plan_id` |
| Plan stopped / safety | `therapy.plan_stopped` | `reason_code`, `canonical_code` |
| Pathology gate cleared | `therapy.pathology_gate_cleared` | `plan_item_id`, `pathology_result_id` |

**Rules:**

- Insert only when **`case_id`** on plan/event supports case-scoped Twin TL **or** product policy allows patient-scoped rows (audit: `consultation.completed` skipped when patient+case missing — same risk for therapy).
- **Dedupe:** `plan_id` + `event_type` + date bucket in `detail` for idempotent replays.
- **Implementation:** central helper (e.g. `createTherapyTimelineEvent`) called from plan activation / event append paths; reuse patterns from `createTimelineEvent` / consultation dual-write.

**Twin TL gap:** pathology and surgery are weak on Twin TL today — therapy mirrors **improve** parity without forcing Profile TL merge in v1.

---

## 11. RLS assumptions

Until policies are codified, assume:

| Principle | Detail |
|-----------|--------|
| **Tenant isolation** | All new tables include `tenant_id`; RLS `USING (tenant_id = current_tenant())` pattern consistent with other clinical tables (align with existing FI Supabase conventions). |
| **Service role** | Loaders used by Twin / admin may use service role with explicit `tenant_id` filter in query; **do not** rely on client-side tenant alone. |
| **Staff / patient access** | Prescribing uses `fi_users` membership; MedicationOS writes should require equivalent **clinical role** checks in server actions (mirror `requireFiPrescribingActor` or shared `requireClinicalActorForTenant`). |
| **Patient portal (future)** | v1 RLS can deny patient direct SELECT on raw events; expose only via controlled API. |
| **Append-only events** | Prefer RLS allowing INSERT for clinical roles, UPDATE/DELETE denied (or restricted to superadmin break-glass). |

**Deliverable:** M6 migration includes policies + documented exceptions for `supabaseAdmin()` paths.

---

## 12. Test plan

| Layer | Tests |
|-------|------|
| **Migrations** | `supabase db reset` locally; verify FKs, CHECK constraints, seed counts. |
| **Pure / policy** | Canonical code validation; gate tag evaluation against fixture pathology JSON; post-op day offset math. |
| **Mutations** | Create draft plan → activate → append events; supersede chain; idempotent timeline insert. |
| **Integration** | Consultation-flagged draft creation (with mock completion summary); surgery template instantiation; pathology gate clear after result fixture. |
| **Twin loader** | Snapshot tests for `clinical.medications` + events preview shape; `SOURCE_TABLES_USED` includes new tables. |
| **RLS** | Optional pgTAP or manual role scripts: tenant A cannot read tenant B plans/events. |

Regression: full prescribing flow (catalogue → Rx → status events) unchanged.

---

## 13. Rollout sequence

Aligned with [medication-os-v1.md §12](../design/medication-os-v1.md), refined for implementation risk:

| Phase | Deliverable | User-visible? |
|-------|-------------|----------------|
| **P0** | M1 + seed canonical; read-only admin page or SQL verification | Low |
| **P1** | M2–M4 + loaders; internal admin CRUD for plans/items (no Twin) | Internal |
| **P2** | Therapy events UI or API for clinicians; append-only discipline | Pilot clinic |
| **P3** | Timeline mirroring (§10) + dedupe | Twin / case timeline |
| **P4** | Twin `clinical.medications` + events preview | Twin dashboard |
| **P5** | Surgery post-op template instantiation (§8) | SurgeryOS |
| **P6** | Pathology gate evaluation + events + Twin flags (§9) | Twin + clinical |
| **P7** | ConsultationOS draft plan bridge (§7), tenant-flagged | Consultation completion |

**Recommendation:** ship **P1–P2** before enabling consultation automation; avoid orphan drafts without events table discipline.

---

## 14. Clear non-goals for v1

Consolidated from design §13 and implementation boundaries:

- **No** drug–drug interaction engine, dose optimisation ML, or external **e-prescribing** networks (DoctorOS remains pharmacy authority).
- **No** inventory / stock management.
- **No** replacing or duplicating **`fi_prescription_status_events`** semantics.
- **No** `fi_pathology_medication_rules` table or full rules engine (tags + app evaluation only).
- **No** mandatory merge of Patient Twin TL and profile treatment timeline ([audit §7](../audits/patient-timeline-unification.md)); optional mirrors only.
- **No** patient-facing MedicationOS portal unless explicitly scoped later (RLS assumes staff-first v1).
- **No** automatic therapy changes from pathology without explicit product policy + clinician confirmation (events may record **recommendations** only if needed).

---

## 15. Open follow-ups (pre-coding)

1. Confirm **`event_kind`** namespace (`therapy.*` vs `medication.*`) with foundation timeline consumers.  
2. Decide v1 inclusion of **`fi_postop_protocol_templates`** vs metadata-only templates.  
3. Align surgery state machine hook names with `fi_case_surgery_plans` / bookings code paths.  
4. Clinical sign-off on **Saw palmetto**, **Spironolactone**, and **controlled analgesic** documentation (design §14).

---

*End of MedicationOS v1 implementation plan.*
