# ConsultationOS handoff audit — automatic execution feasibility and implementation plan

**Scope:** Read-only audit of clinician handoff actions and whether they can run automatically when a guided consultation is completed. **No code changes** are part of this document.

**Related UI copy:** `ConsultationHandoffPanel` states that handoffs are clinician-triggered and nothing is created automatically on completion ([`ConsultationHandoffPanel.tsx`](../../src/components/fi-admin/consultation-forms/ConsultationHandoffPanel.tsx)).

---

## 1. Handoff entry points

| Public action | Module | Delegates to |
|---------------|--------|----------------|
| `createConsultationFollowUpTaskFromSummaryAction` | `lib/actions/fi-consultation-form-actions.ts` | `createConsultationFollowUpTaskFromSummary` |
| `createConsultationQuoteDraftFromSummaryAction` | same | `createConsultationQuoteDraftFromSummary` |
| `createConsultationPathologyRecommendationFromSummaryAction` | same | `createConsultationPathologyRecommendationFromSummary` |
| `createSurgeryPlanningDraftFromConsultationSummaryAction` | same | `createSurgeryPlanningDraftFromConsultationSummary` |

Shared action behaviour:

- `assertCrmTenantWriteAllowed` (tenant + optional `adminKey` from body).
- Resolves `formInstanceId` from `{ formInstanceId }` body.
- `tryResolveFiUserIdForTenant` → `actorUserId` passed into mutations (assignee / ordering user context).
- On success: `revalidatePath` for consultation form routes.

Core logic and preconditions live in **`src/lib/consultationForms/handoff/consultationHandoffMutations.server.ts`**, with eligibility helpers in **`consultationHandoffPure.ts`**.

---

## 2. Completion path (today)

**Action:** `completeConsultationFormInstanceAction` → `completeConsultationFormInstance` (`src/lib/consultationForms/consultationFormMutations.server.ts`).

**Effects:** Locks `fi_consultation_form_instances` (`status: locked`, `completion_summary`, `computed`), updates `fi_consultations` (`structured_data`, `status` → `completed` when draft/in_progress), may set `recommendation_notes`, optionally inserts **`fi_timeline_events`** (`consultation.completed`) when **both** `case_id` and `patient_id` exist.

**Handoffs:** **Not invoked.** Completion and handoffs are decoupled.

---

## 3. Shared server gate: `requireLockedHandoffContext`

All four mutations call this first. It requires:

1. Form instance exists and belongs to the consultation.
2. **`status === "locked"`** and **`completed_at` set** (i.e. Stage 4 completion has already run).
3. **`completion_summary`** parses as `ConsultationCompletionSummary` (`source === "rules_v1"`, ids present).
4. Consultation row loads successfully.

**Implication for automation:** Any automatic runner must execute **after** the completion transaction succeeds (or in the same request **after** the instance row is updated to locked). Calling handoffs **inside** `completeConsultationFormInstance` after the lock update would satisfy `requireLockedHandoffContext`. Calling them in parallel **before** lock would **fail**.

---

## 4. Per-handoff audit

### 4.1 `createConsultationFollowUpTaskFromSummary`

| Layer | Rule |
|--------|------|
| Server | `followUpTaskRecommended(summary)` must be true (`consultationHandoffPure.ts`: `followUpRequired` **or** outcome in `review_later` / `undecided` / `needs_blood_tests`). |
| Server | `consultation.lead_id` required; else throws. |
| Server | Idempotency: existing **open / in_progress / blocked** task on same lead + `consultation_id` + metadata `handoffIdempotencyMetadata(fid, "consultation_completion")` → **reuse**. |
| Side effects | `createCrmTask` (CRM activity, etc.). |

**UI alignment:** Handoff panel blocks without `leadId` and without recommendation.

**Automatic execution:** **Conditionally yes** — only when summary recommends follow-up **and** lead is linked. Safe to retry thanks to idempotency (reuse).

---

### 4.2 `createConsultationQuoteDraftFromSummary`

| Layer | Rule |
|--------|------|
| Server | **No** `followUpTaskRecommended` / pathology-style flag; only `requireLockedHandoffContext` + **lead or case** required. |
| Server | Idempotency: draft `fi_crm_quotes` for same `consultation_id` + metadata `handoffIdempotencyMetadata(fid, "consultation_quote_draft")` → **reuse**. |
| Side effects | Inserts `fi_crm_quotes` draft with line snapshot from summary. |

**UI alignment:** Panel blocks if neither lead nor case (quote always “offered” in copy but CTA disabled without anchor).

**Automatic execution:** **Technically yes** whenever `(lead_id || case_id)` after completion. **Product risk:** unlike follow-up/pathology/surgery, there is **no** summary-based “recommended” gate in the mutation — auto-creating would create a draft for **every** completed consultation that has an anchor, unless you add policy.

---

### 4.3 `createConsultationPathologyRecommendationFromSummary`

| Layer | Rule |
|--------|------|
| Server | `pathologyHandoffRecommended(summary)` → `summary.pathologyRecommended`. |
| Server | `consultation.patient_id` required. |
| Server | Idempotency: `fi_pathology_requests` same tenant/patient/consultation/`form_instance_id`/`status === "saved"` → **reuse**. |
| Side effects | `createPathologyRequest` (CRM activity, clinical records). |

**UI alignment:** Matches panel (patient + pathology recommended).

**Automatic execution:** **Conditionally yes** — when `pathologyRecommended` and patient linked. Idempotent reuse path exists.

---

### 4.4 `createSurgeryPlanningDraftFromConsultationSummary`

| Layer | Rule |
|--------|------|
| Server | `surgeryPlanningHandoffEligible(summary, caseId)` — non-empty case, `outcomeType === "proceed_surgery"`, and at least one of: non-empty `recommendedProcedure`, graft min/max pair, or non-empty `recommendedZones`. |
| Server | `upsertSurgeryPlanForCase` + metadata merge; if `metadata.source_form_instance_id === fid` → **reuse**. |
| Side effects | Mutates **`fi_case_surgery_plans`** (draft planning fields, notes). |

**UI alignment:** Matches panel + `surgeryBlockReason` in UI.

**Automatic execution:** **Conditionally yes** — only for proceed-to-surgery with plan signals and linked case. Still a **clinical governance** decision: pushing draft surgery plan data without explicit clinician click may be acceptable only with tenant policy + audit.

---

## 5. Can these run automatically on completion?

| Handoff | Feasible without new business rules? | Blockers / notes |
|---------|--------------------------------------|------------------|
| Follow-up task | **Yes**, gated | Needs `lead_id`; needs `followUpTaskRecommended(summary)`. |
| Quote draft | **Yes**, gated | Needs `lead_id` or `case_id`; **recommend adding** explicit summary/tenant policy before auto-run (mutation has no “quote recommended” flag today). |
| Pathology request | **Yes**, gated | Needs `patient_id` and `pathologyRecommended`. |
| Surgery planning draft | **Yes**, gated | Needs `case_id` + eligibility; overwrites/updates surgery plan via upsert — policy + audit critical. |

**Cross-cutting:**

1. **Authorization:** Actions assume CRM write gate + human-triggered context. A server-only auto-runner should use **trusted server identity** (e.g. `completedByUserId` as `actorUserId`, or a dedicated system user id per tenant) and **not** depend on `adminKey` from an HTTP body.
2. **Idempotency:** Mutations are largely safe to re-invoke; completion idempotency returns early with existing summary — ensure auto-handoff does **not** run again on that path unless you intend to (e.g. only run when transitioning from submitted → locked in one transaction).
3. **Partial failure:** If one handoff throws, others would not run unless orchestrated with try/catch per step. Plan should define **all-or-nothing vs best-effort** and persistence of partial results.
4. **Revalidation / cache:** Auto path must either call equivalent `revalidatePath` logic or rely on client refresh; background job would need explicit cache strategy.

---

## 6. Implementation plan (only)

### Phase A — Product and policy

1. **Decide per-tenant (or global) toggles:** e.g. `auto_handoff_follow_up`, `auto_handoff_quote`, `auto_handoff_pathology`, `auto_handoff_surgery` — default **off** to preserve current clinician-triggered behaviour.
2. **Quote draft policy:** Either (i) add a `quoteDraftRecommended`-style signal to `ConsultationCompletionSummary` + builder, or (ii) tie auto-quote to an explicit outcome list / template slug allowlist, or (iii) leave quote **manual-only** even when other toggles exist.
3. **Surgery policy:** Require toggle + optional “only if case already has no conflicting plan” rules; document medico-legal ownership (draft only vs approval workflow).
4. **Audit:** Log auto-run outcome (which handoffs ran, reused vs created, errors) on `fi_consultations` metadata or a dedicated append-only table for support.

### Phase B — Orchestration API (server)

1. **Extract** `runConsultationHandoffsFromCompletion(input)` in `consultationHandoffMutations.server.ts` (or adjacent module) that:
   - Accepts `tenantId`, `consultationId`, `formInstanceId`, `actorUserId`, `flags`, optional `summary` override (normally reload from locked instance).
   - For each enabled flag, runs the corresponding `create*` function inside **try/catch** (or `Promise.allSettled`) per product choice.
   - Returns structured result `{ followUp?, quote?, pathology?, surgery?, errors[] }`.
2. **Keep** existing four actions as thin wrappers that call the orchestrator with **single** handoff enabled (preserves current UI contract) **or** document UI calling orchestrator with one flag — either way avoids duplicating gates.

### Phase C — Wire to completion (choose one)

**Option C1 — Inline (same request):** After successful lock + consultation update in `completeConsultationFormInstance`, if tenant flags allow, call orchestrator with `actorUserId: input.completedByUserId`. **Pros:** atomic with user’s “Complete” click. **Cons:** longer request; failure handling must not roll back completion unless product requires transaction (Postgres transaction wrapping completion + handoffs would need careful ordering and savepoints).

**Option C2 — Post-commit hook:** Completion returns; server action schedules orchestrator (in-process `queueMicrotask` is weak; prefer explicit **workflow dispatch** if `workflowEngine` is adopted) or writes a “pending_handoffs” row for a future worker (**user excluded cron** in this plan — so only synchronous follow-up in same process or DB-driven retry on next read unless you later allow cron).

**Option C3 — FI Workflow Engine:** Dispatch `consultation.completed` with payload `{ consultationId, formInstanceId }`; registered handler loads flags and runs orchestrator. Keeps `completeConsultationFormInstance` free of handoff imports if desired.

**Recommendation for “no cron” constraint:** **C1 or C3 synchronous** after persistence, with **best-effort per handoff** (catch, log, return partial success to client) unless product mandates transactional all-or-nothing.

### Phase D — Client / API contract

1. If auto-handoffs run on complete: extend `completeConsultationFormInstanceAction` response with optional `handoffs: HandoffRunReport` so UI can toast “Follow-up task created” without opening handoff panel.
2. **ConsultationHandoffPanel:** When server reports existing ids from auto-run, `loadConsultationHandoffState` / `handoffInitial` already supports “Already exists” — verify loader runs after refresh.

### Phase E — Safety and rollout

1. **Feature flag** in env or tenant metadata; pilot tenants first.
2. **Dry-run mode** (optional): compute “would create” without insert — dev/admin only.
3. **Tests:** Unit tests for orchestrator with mocked Supabase for each gate; integration tests for idempotent re-run after completion.

### Phase F — Out of scope for this plan (future)

- Patient-facing notifications from handoffs (explicitly out of current handoff UI).
- Cron-based reconciliation of failed auto-handoffs.
- Non–guided-consultation completion paths (`completeConsultationDraftAction` in `fi-consultation-actions.ts` if it differs) — verify whether that path should also trigger handoffs for parity.

---

## 7. Source map (for implementers)

| Concern | File |
|---------|------|
| Actions | `lib/actions/fi-consultation-form-actions.ts` |
| Mutations + idempotency + `loadConsultationHandoffState` | `src/lib/consultationForms/handoff/consultationHandoffMutations.server.ts` |
| Pure eligibility / copy builders | `src/lib/consultationForms/handoff/consultationHandoffPure.ts` |
| Types | `src/lib/consultationForms/handoff/consultationHandoffTypes.ts` |
| Completion (no handoffs) | `src/lib/consultationForms/consultationFormMutations.server.ts` (`completeConsultationFormInstance`) |
| UI handoff cards | `src/components/fi-admin/consultation-forms/ConsultationHandoffPanel.tsx` |

---

*End of audit and implementation plan.*
