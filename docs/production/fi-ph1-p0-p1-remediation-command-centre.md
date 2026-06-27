# FI-PH1 — P0/P1 Remediation Command Centre

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Architecture freeze:** Active — remediation and validation only; no new modules  
**Status:** Active — all blockers **Not started** until evidence attached  
**Last updated:** To verify

**Related docs**

- [Evolved production blockers](./evolved-production-blockers.md) — full blocker catalogue
- [Evolved go-live risk register](./evolved-go-live-risk-register.md) — all 30 blockers with posture
- [Evolved go/no-go checklist](./evolved-go-no-go-checklist.md) — executive decision gate
- [Evolved smoketest journey](./evolved-smoketest-journey.md) — end-to-end validation template
- [Operational validation framework](./evolved-operational-validation.md)
- [FI-PH1 sprint definition](./fi-ph1-production-hardening-sprint.md)
- [Production hardening master checklist](../runbooks/fi-os-production-hardening-master-checklist.md)

---

## Purpose

Provide a single **production remediation control layer** for Evolved go-live: explicit P0/P1 risks, ordered execution, required evidence, sign-off criteria, and escalation rules. This document is the operational command centre for FI-PH1 Task 3 — not a feature spec.

**Success:** Every P0 blocker is **Complete** or **Accepted risk** with named owner, dated evidence, and explicit go-live decision before Evolved production sign-off.

---

## Scope

| In scope | Out of scope (architecture freeze) |
|----------|-------------------------------------|
| P0/P1 blocker remediation and mitigation | New OS modules or UI redesign |
| Evidence capture (runbooks, smoke logs, SQL read-only probes, sign-offs) | Intelligence Bus production activation |
| Operational SOPs (calendar, financial, reception) | Google staged → FI booking automation |
| Go/no-go and risk acceptance documentation | Code root consolidation (`lib/` vs `src/lib/`) |
| Real Evolved staff provisioning and identity validation | HubSpot inbound webhooks (not in codebase) |

---

## Execution order

Run remediation in this order. Do not mark downstream items **Complete** until upstream P0 gates are satisfied or explicitly **Accepted risk**.

| Phase | Order | Blocker(s) | Rationale |
|-------|------:|------------|-----------|
| **1 — Infrastructure & DR** | 1 | BLK-SEC-01 | PHI without verified restore invalidates all other work |
| | 2 | BLK-SEC-02 | Cron and secrets affect reminders, HR sync, webhooks |
| **2 — Access & blast radius** | 3 | BLK-SEC-05 | Real identities required before workflow validation |
| | 4 | BLK-LEG-01 | Legacy API decision before HairAudit/HLI ingest testing |
| **3 — Financial safety** | 5 | BLK-FIN-01 | Prevent staff treating manual records as live payments |
| | 6 | BLK-FIN-02 | Manual deposit clearance gate before surgery booking |
| **4 — Operational mitigations (P1)** | 7 | BLK-CAL-01, BLK-CAL-02 | Calendar SOP and sync health review |
| | 8 | BLK-REC-01 | Reception dry-run / live-send confirmation |
| | 9 | BLK-INT-01 | Intelligence Bus production-off acknowledgement |
| | 10 | BLK-ACA-01, BLK-ACA-02 | AcademyOS partial status acknowledgement |
| | 11 | BLK-MED-01 | MedicationOS embedded-only acknowledgement |
| | 12 | BLK-X-05 | Analytics publisher incompleteness acknowledgement |
| **5 — Validation closure** | 13 | — | Execute [smoketest journey](./evolved-smoketest-journey.md); update [go/no-go checklist](./evolved-go-no-go-checklist.md) |

---

## Owners (placeholders)

| Role | Placeholder | Responsibility |
|------|-------------|----------------|
| **Sprint lead** | To verify | Command centre status, escalation, go/no-go pack |
| **Platform / infra** | To verify | BLK-SEC-01, BLK-SEC-02, Vercel cron, Supabase backup |
| **Security** | To verify | BLK-LEG-01 decision, BLK-SEC-03 spot-checks, legacy API posture |
| **Financial ops** | To verify | BLK-FIN-01 training, BLK-FIN-02 clearance SOP |
| **Evolved clinic lead** | To verify | Staff SOP sign-off, smoketest journey, accepted risks |
| **Clinical ops** | To verify | Calendar SOP, surgery clearance checklist, procedure day |
| **Product / FI admin** | To verify | P1 acknowledgements (bus, Academy, Medication, analytics) |

---

## P0 blockers

### BLK-SEC-01 — Backup / PITR + storage restore drill

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Production impact** | Production PHI without verified point-in-time recovery and storage restore invalidates DR commitments. Data loss or corruption may be unrecoverable. |
| **Remediation action** | Complete [Supabase backup / PITR setup](../runbooks/fi-os-supabase-backup-setup.md) and [storage backup restore drill](../runbooks/fi-os-storage-backup-restore-drill.md); record drill date, operator, and outcome. If deferred, require executive **Accepted risk** with dated sign-off. |
| **Validation evidence** | Dated drill log; PITR enabled screenshot or Supabase dashboard export; restore test artifact (table row count or object checksum); master checklist items checked |
| **Status** | Not started |
| **Go-live decision** | Block |

---

### BLK-SEC-02 — Secrets rotation + Vercel cron verification

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Stale `SUPABASE_SERVICE_ROLE_KEY`, cron secrets, or integration secrets increase breach and replay risk. Missing Vercel cron → stale IIOHR staff directory and reminder backlog. |
| **Remediation action** | Execute master checklist manual sections: rotate service role, `FI_REMINDER_CRON_SECRET`, integration secrets; configure Vercel cron for reminders and [IIOHR Perth staff sync](../iiohr-hr-perth-staff-sync-cron.md); verify cron invocations in Vercel logs. |
| **Validation evidence** | Sprint change log entries (date, variable, approver — no secret values); Vercel cron job list; successful cron HTTP 200 log sample; `pnpm run check:env` pass with production-like vars |
| **Status** | Not started |
| **Go-live decision** | Block |

---

### BLK-LEG-01 — Legacy `/api/fi/*` go/no-go decision

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Routes (`events`, `submit`, `uploads`, `cases`, `partners`, `run-model`) gated by `FI_LEGACY_FI_API_ENABLED` (default off) + single `FI_LEGACY_FI_API_SECRET`. When enabled: **High** blast-radius per [API routes inventory](../security/api-routes-inventory.md). HairAudit/HLI ingest may depend on this path. |
| **Remediation action** | Record explicit go/no-go: **(A)** remain disabled — document HairAudit ingest alternative or defer; **(B)** enable for ingest only — Bearer-only, rotate secret, IP allowlist, sprint change log. Never enable without written decision. |
| **Validation evidence** | Signed decision memo (owner + date); Vercel env screenshot showing `FI_LEGACY_FI_API_ENABLED` value; if enabled: secret rotation ticket + smoke probe of `/api/fi/events` auth rejection with wrong secret |
| **Status** | Not started |
| **Go-live decision** | Block (until decision recorded; default posture: remain off = Allow with mitigation) |

---

### BLK-FIN-01 — Financial manual-payment safety guard

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | `fi_payment_records` is **manual/internal tracking only** — not bank ledger, invoicing, or POS ([production readiness](../runbooks/fi-os-production-readiness.md)). Staff treating UI as live payment capture creates commercial and compliance risk. |
| **Remediation action** | Staff training artifact confirming manual scope; UI copy audit where payment records are created; Stripe remains disabled unless BLK-FIN-03 separately validated; document in financial SOP. |
| **Validation evidence** | Signed staff acknowledgement (Evolved financial + front desk); training date; checklist row in [Evolved production checklist](./evolved-production-checklist.md#financialos) Financial section; optional screenshot of payment record create flow with understood labels |
| **Status** | Not started |
| **Go-live decision** | Block |

---

### BLK-FIN-02 — Deposit clearance manual gate before surgery

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | `payment.deposit.confirmed` bus event is **Planned**. Clearance engine and pathway inbox exist but automated surgery unlock is partial — procedure day may proceed without enforced financial gate. |
| **Remediation action** | Publish and adopt **manual deposit clearance checklist** before surgery booking: verify deposit status in `fi_payment_records` / pathway inbox; record clearance in case notes or checklist; do not rely on automated gate for FI-PH1. |
| **Validation evidence** | Signed SOP attached to sprint folder; smoketest step 7–8 in [smoketest journey](./evolved-smoketest-journey.md) showing manual gate applied; named owner for procedure-day financial check |
| **Status** | Not started |
| **Go-live decision** | Block (until manual gate SOP signed; then Allow with mitigation) |

---

### BLK-SEC-05 — Real Evolved user provisioning and identity validation

| Field | Detail |
|-------|--------|
| **Severity** | Medium (elevated to **P0** for go-live gate) |
| **Production impact** | Production gates not verified with real identities until Evolved staff provisioned in `fi_users` + `fi_os_identities`. Auth shell access and role matrix untested for live operators. |
| **Remediation action** | Provision real Evolved staff (`pnpm run dev:provision:evolved` or production equivalent per runbook); verify `assertFiAdminShellAccess` per [fi-os-access-production.md](../fi-os-access-production.md); run `pnpm run smoke:prod` post-deploy with production `FI_BASE_URL` + tenant ID. |
| **Validation evidence** | Read-only SQL or admin UI confirmation of `fi_users` rows (no PII in ticket — use internal IDs); smoke:prod log pass; checklist Security section rows S1–S7 |
| **Status** | Not started |
| **Go-live decision** | Block |

---

## P1 blockers

### BLK-CAL-01 — Google Calendar SOP: FI-native bookings are source of record

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Staged Google import approve (`approveExternalCalendarEvent`) updates staging only — audit includes `no_fi_booking_created: true`. Evolved cannot rely on Google → FI automatic booking creation. |
| **Remediation action** | Document Evolved booking SOP: **FI-native booking create is SoR**; Google staged review is **review-only**; after staged approve, staff must manually create FI booking if needed. Include in staff onboarding. |
| **Validation evidence** | Published SOP (link or PDF in sprint folder); smoketest step 2 notes confirming manual path; optional staged approve probe showing no `fi_bookings` row |
| **Status** | Not started |
| **Go-live decision** | Allow with mitigation |

**Related:** BLK-CAL-02 — weekly sync health review (`fi_calendar_sync_review_queue`, `fi_calendar_sync_health`).

---

### BLK-REC-01 — ReceptionOS dry-run / live-send confirmation

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | `RECEPTION_OS_COMMUNICATION_DRY_RUN` defaults **on** (unset = dry-run). Misconfiguration could send real SMS/email to patients. |
| **Remediation action** | Verify Vercel env: dry-run on for FI-PH1 pilot; live send flags off unless explicitly approved; run `pnpm run validate:reception-os`; check system status panel `dryRunEnabled` after each deploy. |
| **Validation evidence** | Env audit in sprint change log; `validate:reception-os` output; reception pilot status screenshot |
| **Status** | Not started |
| **Go-live decision** | Allow with mitigation |

---

### BLK-INT-01 — Intelligence Bus production-off acknowledgement

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Internal intelligence bus defaults to `noop` in production; shadow and persistent event log **forced off** when `NODE_ENV=production`. Cross-system automation and replay observability unavailable — operators must not expect bus-driven workflows. |
| **Remediation action** | Product and Evolved clinic acknowledge: use CRM activity + `fi_analytics_events` for ops metrics; no production flag changes without [governance pack](../governance/README.md) sign-off; document in accepted risks. |
| **Validation evidence** | Signed acknowledgement in go/no-go checklist; env confirmation that bus persistence flags are off; no open tickets assuming production dispatch |
| **Status** | Not started |
| **Go-live decision** | Allow with mitigation |

---

### BLK-ACA-01 + BLK-ACA-02 — AcademyOS partial status acknowledgement

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Procedure privilege enforcement not fully wired to surgery assignment; IIOHR competency export ingest partial — staff may appear qualified when not. |
| **Remediation action** | Acknowledge partial automation: **manual privilege verification on procedure day**; monitor `fi_competency_import_events` and HR sync health; do not rely on automated AcademyOS gate for FI-PH1. |
| **Validation evidence** | Procedure-day checklist includes manual privilege check; signed acknowledgement from clinical lead; AcademyOS checklist rows marked Accepted risk |
| **Status** | Not started |
| **Go-live decision** | Allow with mitigation |

---

### BLK-MED-01 — MedicationOS embedded-only status acknowledgement

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Therapy plan timeline and Patient Twin integration incomplete; post-op medication bundles partial. Operators may confuse therapy plans with prescriptions. |
| **Remediation action** | Acknowledge **DoctorOS prescribing (`fi_patient_prescriptions`) as legal Rx SoR**; MedicationOS therapy plans are pilot/embedded-only; staff training — prescriptions via prescribing workspace only (see BLK-MED-02). |
| **Validation evidence** | Staff training note; Patient Twin load test documenting MedicationOS section skip-on-error behaviour; checklist acknowledgement |
| **Status** | Not started |
| **Go-live decision** | Allow with mitigation |

---

### BLK-X-05 — Analytics publisher incompleteness acknowledgement

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Not all journey steps guarantee analytics emission; module publishers incomplete for full journey closure. |
| **Remediation action** | Acknowledge analytics gaps; use `fi_crm_activity_events` and manual journey verification for FI-PH1; smoketest step 12 records what emitted vs expected. |
| **Validation evidence** | Smoketest journey analytics row; read-only query on `fi_analytics_events` for SMOKETEST- tenant; signed acknowledgement that executive dashboards may be incomplete |
| **Status** | Not started |
| **Go-live decision** | Allow with mitigation |

---

## Additional P1 items (risk register — not duplicated above)

| ID | Summary | Status | Go-live decision |
|----|---------|--------|------------------|
| BLK-FIN-03 | Stripe webhook / idempotency — keep disabled unless dedupe verified | Not started | Allow with mitigation |
| BLK-SEC-03 | Service-role concentration — RLS spot-check, cross-tenant denial smoke | Not started | Allow with mitigation |
| BLK-SEC-04 | Staff PIN rate limiting / role matrix — short PIN policy | Not started | Allow with mitigation |
| BLK-LEG-02 | Audit/report tenant APIs — session auth on production URL | Not started | Allow with mitigation |
| BLK-CAL-02 | Sync conflict review queue — weekly ops review | Not started | Allow with mitigation |
| BLK-X-03 | Parallel lead models (`fi_crm_leads` vs `fi_leads`) — confirm Evolved SoR | Not started | To verify |

Full detail: [evolved-go-live-risk-register.md](./evolved-go-live-risk-register.md).

---

## Required evidence (master list)

| Evidence type | Applies to | Storage location |
|---------------|------------|------------------|
| Dated restore drill log | BLK-SEC-01 | Sprint evidence folder / master checklist |
| Cron + secrets change log (no values) | BLK-SEC-02 | [FI-PH1 sprint change log](./fi-ph1-production-hardening-sprint.md#sprint-change-log) |
| Legacy API decision memo | BLK-LEG-01 | Go/no-go pack |
| Staff financial training sign-off | BLK-FIN-01 | Evolved ops folder |
| Deposit clearance SOP | BLK-FIN-02 | Evolved ops folder |
| `pnpm run smoke:prod` output | BLK-SEC-05 | CI log or manual run artifact |
| Calendar + reception SOPs | BLK-CAL-01, BLK-REC-01 | Sprint folder |
| P1 acknowledgement sign-offs | BLK-INT-01, ACA, MED, X-05 | [Go/no-go checklist](./evolved-go-no-go-checklist.md) |
| SMOKETEST- journey completion | All workflows | [Smoketest journey](./evolved-smoketest-journey.md) |

**Rule:** Do not mark **Complete** without attaching evidence. Use **Accepted risk** only with named owner, date, and executive approver.

---

## Sign-off criteria

FI-PH1 P0/P1 remediation command centre is **closed** when:

| # | Criterion | Owner |
|---|-----------|-------|
| 1 | All P0 blockers are **Complete** or **Accepted risk** with evidence | Sprint lead |
| 2 | No P0 blocker remains **Block** without executive override documented | Clinic + platform lead |
| 3 | All P1 blockers are **Complete**, **Accepted risk**, or **Allow with mitigation** with SOP/acknowledgement | Sprint lead |
| 4 | [Smoketest journey](./evolved-smoketest-journey.md) executed — all steps Pass or documented Accepted risk | Evolved clinic lead |
| 5 | [Readiness scorecard](./readiness-scorecard.md) ≥ 95/100 or deductions documented | Sprint lead |
| 6 | [Go/no-go checklist](./evolved-go-no-go-checklist.md) records final decision: GO / GO WITH MITIGATION / NO-GO | Executive sponsor |

---

## Escalation rules

| Severity | Trigger | Action | Response time |
|----------|---------|--------|---------------|
| **P0 — Stop ship** | Cross-tenant PHI exposure; auth bypass; open P0 **Block** without acceptance | Halt deploy and validation; incident channel | Immediate |
| **P1 — Sprint block** | Evolved workflow cannot complete (booking, consult save, payment record corruption) | Fix within FI-PH1; update failure notes | Same business day |
| **P2 — Mitigate** | Degraded UX, sync lag, non-blocking integration | Document; scorecard deduction; schedule post-PH1 | 3 business days |
| **Risk acceptance** | P0/P1 cannot close before go-live date | Executive sign **Accepted risk** on go/no-go checklist | Before GO decision |

**Escalation path:** Operator → Sprint lead → Platform lead → Executive sponsor (Evolved + FI)

---

## Status dashboard

| ID | Priority | Status | Go-live decision | Owner | Evidence ref |
|----|----------|--------|------------------|-------|--------------|
| BLK-SEC-01 | P0 | Not started | Block | To verify | — |
| BLK-SEC-02 | P0 | Not started | Block | To verify | — |
| BLK-LEG-01 | P0 | Not started | Block | To verify | — |
| BLK-FIN-01 | P0 | Not started | Block | To verify | — |
| BLK-FIN-02 | P0 | Not started | Block | To verify | — |
| BLK-SEC-05 | P0 | Not started | Block | To verify | — |
| BLK-CAL-01 | P1 | Not started | Allow with mitigation | To verify | — |
| BLK-REC-01 | P1 | Not started | Allow with mitigation | To verify | — |
| BLK-INT-01 | P1 | Not started | Allow with mitigation | To verify | — |
| BLK-ACA-01/02 | P1 | Not started | Allow with mitigation | To verify | — |
| BLK-MED-01 | P1 | Not started | Allow with mitigation | To verify | — |
| BLK-X-05 | P1 | Not started | Allow with mitigation | To verify | — |

---

## Change log

| Date | Change | Author |
|------|--------|--------|
| To verify | FI-PH1 Task 3 — P0/P1 remediation command centre created | — |
