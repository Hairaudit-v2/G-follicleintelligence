# Evolved Hair Restoration — Production Blockers Audit

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Scope:** Known platform gaps derived from **existing codebase and docs only** — no speculative features.

**Related docs**

- [P0/P1 remediation command centre](./fi-ph1-p0-p1-remediation-command-centre.md)
- [Go-live risk register](./evolved-go-live-risk-register.md)
- [Go/no-go checklist](./evolved-go-no-go-checklist.md)
- [Smoketest journey](./evolved-smoketest-journey.md)
- [Operational validation framework](./evolved-operational-validation.md)
- [Workflow matrix](./evolved-workflow-matrix.md)
- [Production hardening master checklist](../runbooks/fi-os-production-hardening-master-checklist.md)
- [Infrastructure hardening audit](../security/infrastructure-hardening-audit.md)
- [API routes inventory](../security/api-routes-inventory.md)

**Severity legend**

| Severity | Definition |
|----------|------------|
| **Critical** | Blocks safe production ops or poses immediate data/security risk |
| **High** | Degrades core Evolved workflow; requires workaround or explicit acceptance |
| **Medium** | Operational friction; documented mitigation exists |
| **Low** | Technical debt; deferrable post-FI-PH1 |

**Remediation priority:** P0 (before go-live) · P1 (during FI-PH1) · P2 (post-PH1) · P3 (backlog)

---

## Blocker index

| ID | Category | Severity | Priority |
|----|----------|----------|----------|
| BLK-CAL-01 | Calendar sync | High | P1 |
| BLK-CAL-02 | Calendar sync | Medium | P1 |
| BLK-CAL-03 | Calendar sync | Medium | P2 |
| BLK-ACA-01 | AcademyOS partial | Medium | P2 |
| BLK-ACA-02 | AcademyOS partial | Medium | P2 |
| BLK-MED-01 | MedicationOS partial | Medium | P2 |
| BLK-MED-02 | MedicationOS partial | Low | P3 |
| BLK-FIN-01 | FinancialOS readiness | High | P0 |
| BLK-FIN-02 | FinancialOS readiness | High | P1 |
| BLK-FIN-03 | FinancialOS readiness | Medium | P1 |
| BLK-REC-01 | Reception dry-run | Medium | P1 |
| BLK-REC-02 | Reception dry-run | Low | P2 |
| BLK-INT-01 | Intelligence Bus staged | High | P1 |
| BLK-INT-02 | Intelligence Bus staged | Medium | P2 |
| BLK-INT-03 | Intelligence Bus staged | Medium | P2 |
| BLK-SEC-01 | Security audit gaps | Critical | P0 |
| BLK-SEC-02 | Security audit gaps | High | P0 |
| BLK-SEC-03 | Security audit gaps | High | P1 |
| BLK-SEC-04 | Security audit gaps | Medium | P1 |
| BLK-SEC-05 | Security audit gaps | Medium | P2 |
| BLK-LEG-01 | Legacy API routes | High | P0 |
| BLK-LEG-02 | Legacy API routes | High | P1 |
| BLK-DCR-01 | Dual code roots | Medium | P2 |
| BLK-DCR-02 | Dual code roots | Medium | P2 |
| BLK-DCR-03 | Dual code roots | Low | P3 |

---

## Calendar sync

### BLK-CAL-01 — Staged Google import does not create FI bookings

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Staff approving staged external calendar events (`approveExternalCalendarEvent`) update staging status only — audit detail explicitly includes `no_fi_booking_created: true` (`src/lib/onboarding-os/googleCalendarConnector.server.ts`). Evolved cannot rely on Google → FI automatic booking creation for day-to-day ops. |
| **Remediation priority** | P1 |
| **Evidence** | OnboardingOS connector; [calendar-os.md](../platform-architecture/calendar-os.md) graceful degradation rule |
| **Mitigation (FI-PH1)** | Treat FI-native booking create as SoR; use Google as mirror/review only; document manual booking step after staged approve |

### BLK-CAL-02 — Sync conflict review queue may backlog silently

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | OAuth expiry, rate limits, or reconciliation conflicts populate `fi_calendar_sync_review_queue` and `fi_calendar_sync_health`. Unreviewed items cause calendar mirror drift vs FI bookings. |
| **Remediation priority** | P1 |
| **Evidence** | GC-7/GC-8 in [calendar-os.md](../platform-architecture/calendar-os.md); `fi_calendar_sync_runs` observability |
| **Mitigation (FI-PH1)** | Weekly ops review of sync health panel; FI bookings remain authoritative |

### BLK-CAL-03 — Timely webhook optional and replay protection incomplete

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Timely path depends on `FI_TIMELY_WEBHOOK_SECRET` (min 16 chars). Master checklist lists webhook replay protection as **should fix** — duplicate appointment webhooks could create inconsistent booking state if Evolved enables Timely. |
| **Remediation priority** | P2 |
| **Evidence** | [fi-os-production-hardening-master-checklist.md](../runbooks/fi-os-production-hardening-master-checklist.md); [api-routes-inventory.md](../security/api-routes-inventory.md) |
| **Mitigation (FI-PH1)** | Confirm Timely N/A for Evolved or monitor 401 rates; idempotency keys deferred |

---

## AcademyOS partial implementation

### BLK-ACA-01 — Procedure privilege enforcement not fully wired to surgery assignment

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | AcademyOS has `procedurePrivilegeEngine`, `fi_procedure_privileges`, and competency projections (`src/lib/academy-os/`), but registry lists `training.completed`, `competency.approved`, and bus events as **Planned**. Surgery day team assignment may not block unqualified staff without manual checks. |
| **Remediation priority** | P2 |
| **Evidence** | [academy-os.md](../platform-architecture/academy-os.md); `procedurePrivilegeIntegration.test.ts` |
| **Mitigation (FI-PH1)** | Manual privilege verification on procedure day; do not rely on automated gate |

### BLK-ACA-02 — IIOHR competency export ingest partial

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Competency receiver and import events exist (`fi_competency_import_events`, `fi_staff_competency_projections`), but stale exports or parse errors leave `expires_at` / readiness flags wrong — staff may appear qualified when not. |
| **Remediation priority** | P2 |
| **Evidence** | [academy-os.md](../platform-architecture/academy-os.md) failure conditions |
| **Mitigation (FI-PH1)** | Monitor competency import events; HR sync health dashboard |

---

## MedicationOS partial implementation

### BLK-MED-01 — Therapy plan timeline and Patient Twin integration incomplete

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Migration `20260719120001_fi_medication_os_v1.sql` and `src/lib/medicationOs/` modules exist, but [patient timeline audit](../audits/patient-timeline-unification.md) notes surgery/medication history gaps. Patient Twin loader skips MedicationOS section on error (`patientTwinLoader.server.ts`). Post-op medication bundles partially implemented. |
| **Remediation priority** | P2 |
| **Evidence** | [medication-os-v1-implementation-plan.md](../implementation-plans/medication-os-v1-implementation-plan.md) (planning doc); live mutations in `medicationOsMutations.server.ts` |
| **Mitigation (FI-PH1)** | Use DoctorOS prescribing (`fi_patient_prescriptions`) for legal Rx; treat MedicationOS therapy plans as pilot |

### BLK-MED-02 — Dual-track plan vs prescription not unified in UI

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Production impact** | MedicationOS design preserves DoctorOS prescribing as SoR; operators may confuse therapy plans with pharmacy prescriptions. |
| **Remediation priority** | P3 |
| **Evidence** | [medication-os-v1.md](../design/medication-os-v1.md) |
| **Mitigation (FI-PH1)** | Staff training — prescriptions via prescribing workspace only |

---

## FinancialOS production readiness

### BLK-FIN-01 — Manual payment records are not live card processing

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | [Production readiness](../runbooks/fi-os-production-readiness.md) explicitly states `fi_payment_records` is **manual/internal tracking only** — not bank ledger, invoicing, or POS. Evolved staff treating UI as live payment capture creates commercial and compliance risk. |
| **Remediation priority** | P0 |
| **Evidence** | `fi_payment_records` migration; commercial non-scope section |
| **Mitigation (FI-PH1)** | Training + UI copy audit; Stripe only if separately validated |

### BLK-FIN-02 — Deposit clearance gating before surgery incomplete

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | FinancialOS registry lists `payment.deposit.confirmed` as **Planned** on event bus. Clearance engine and pathway inbox exist (`financialPaymentPathwayInbox.server.ts`) but automated surgery unlock is partial — procedure day may proceed without enforced financial gate. |
| **Remediation priority** | P1 |
| **Evidence** | [financial-os.md](../platform-architecture/financial-os.md) failure conditions; [surgery-os.md](../platform-architecture/surgery-os.md) |
| **Mitigation (FI-PH1)** | Manual clearance checklist on procedure day; record deposit status in `fi_payment_records` |

### BLK-FIN-03 — Stripe webhook and idempotency dependency

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | If Stripe enabled, webhook handler uses service role; duplicate PaymentIntent rows blocked by idempotency migration — production push failures documented in hardening checklist if duplicates exist. |
| **Remediation priority** | P1 |
| **Evidence** | [payment-webhook-idempotency.md](../security/payment-webhook-idempotency.md); master checklist migration note |
| **Mitigation (FI-PH1)** | Keep Stripe disabled for FI-PH1 unless dedupe verified |

---

## Reception communication dry-run flags

### BLK-REC-01 — Production pilot depends on dry-run default

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | `RECEPTION_OS_COMMUNICATION_DRY_RUN` defaults **on** (unset = dry-run). If unset incorrectly or live send flags enabled, pilot sends real SMS/email to patients. System status panel surfaces `dryRunEnabled` (`receptionOsPilotStatusModel.ts`). |
| **Remediation priority** | P1 |
| **Evidence** | [reception-os-production-readiness.md](../runbooks/reception-os-production-readiness.md) |
| **Mitigation (FI-PH1)** | Verify env in Vercel; add to sprint change log; check panel on every deploy |

### BLK-REC-02 — Live send requires multiple explicit flags

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Production impact** | Live email/SMS requires dry-run off **and** `RECEPTION_OS_EMAIL_SEND_ENABLED` / `RECEPTION_OS_SMS_SEND_ENABLED` **and** Resend/Twilio configured — multi-gate reduces accidental send risk but increases config error surface. |
| **Remediation priority** | P2 |
| **Evidence** | Reception runbook §2–3 |
| **Mitigation (FI-PH1)** | Keep all live flags off for FI-PH1 |

---

## Intelligence Bus staged mode

### BLK-INT-01 — Production dispatch and persistence forcibly disabled

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Internal intelligence bus defaults to `noop` in production (`internalBus.ts`). Shadow events (`FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED`) and persistent event log (`FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED`) are **forced off** when `NODE_ENV=production` (`internalBusEnv.ts`, `persistentEventLogEnv.ts`). Cross-system automation and replay observability unavailable in prod — operators must not expect bus-driven workflows. |
| **Remediation priority** | P1 |
| **Evidence** | [Stage 11 shadow](../stage11-internal-bus-shadow-event.md); [Stage 16 governance](../governance/README.md); `intelligenceCore.stage16.test.ts` |
| **Mitigation (FI-PH1)** | Use CRM activity + `fi_analytics_events` for ops metrics; bus remains dev/staging only |

### BLK-INT-02 — Governed replay / dispatch_future allow-list empty

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Stage 15–16 governance requires sign-off before any production dispatch. `dispatch_future` allow-list empty by contract tests — replay tooling is operator rehearsal only. |
| **Remediation priority** | P2 |
| **Evidence** | [governance/README.md](../governance/README.md); [stage15-governed-intelligence-replay-dispatch.md](../stage15-governed-intelligence-replay-dispatch.md) |
| **Mitigation (FI-PH1)** | No production flag changes without governance pack sign-off |

### BLK-INT-03 — Vocabulary drift between schema and design docs

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | `src/lib/fi/vocabulary.ts` lists event names not accepted by authoritative `lib/fi/events/schema.ts` — producer onboarding confusion; HairAudit/HLI events may be rejected at ingest. |
| **Remediation priority** | P2 |
| **Evidence** | [ecosystem-architecture-stabilization-audit.md](../ecosystem-architecture-stabilization-audit.md) §2.1, §17 |
| **Mitigation (FI-PH1)** | Treat `schema.ts` as runtime truth for `/api/fi/events` |

---

## Security audit gaps

### BLK-SEC-01 — Backup / PITR and restore drill not completed

| Field | Detail |
|-------|--------|
| **Severity** | Critical |
| **Production impact** | Master checklist items **Backup / PITR setup** and **DB + Storage restore drill** remain unchecked. Production PHI without verified restore invalidates DR commitments. |
| **Remediation priority** | P0 |
| **Evidence** | [fi-os-supabase-backup-setup.md](../runbooks/fi-os-supabase-backup-setup.md); [fi-os-storage-backup-restore-drill.md](../runbooks/fi-os-storage-backup-restore-drill.md) |
| **Mitigation (FI-PH1)** | Complete drills or document dated deferral with executive risk acceptance |

### BLK-SEC-02 — Secrets rotation and Vercel cron not verified

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Open checklist: rotate `SUPABASE_SERVICE_ROLE_KEY`, cron secrets, integration secrets; configure Vercel cron for reminders + IIOHR HR sync. Missing cron → stale staff directory and reminder backlog. |
| **Remediation priority** | P0 |
| **Evidence** | [fi-os-production-hardening-master-checklist.md](../runbooks/fi-os-production-hardening-master-checklist.md) |
| **Mitigation (FI-PH1)** | Complete manual Vercel + Supabase setup sections |

### BLK-SEC-03 — Concentrated service-role trust (`supabaseAdmin`)

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | ~230 files reference `supabaseAdmin()` bypassing RLS. Missing `.eq('tenant_id', …)` in any loader is cross-tenant exposure. `/fi-admin/system/*` pages flagged for broad reads without tenant filter. |
| **Remediation priority** | P1 |
| **Evidence** | [supabase-admin-inventory.md](../security/supabase-admin-inventory.md); [infrastructure-hardening-audit.md](../security/infrastructure-hardening-audit.md) |
| **Mitigation (FI-PH1)** | RLS spot-check; smoke cross-tenant denial; restrict system admin page usage |

### BLK-SEC-04 — Staff PIN rate limiting and role matrix undocumented

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Master checklist **should fix**: Staff PIN rate limiting, lockout, audit export; role hardening for `crm_operator` / `member` on PatientOS mutations. Reception board PIN is attack surface. |
| **Remediation priority** | P1 |
| **Evidence** | Master checklist § Should fix |
| **Mitigation (FI-PH1)** | Short PIN rotation policy; monitor `fi_staff_pin_audit` |

### BLK-SEC-05 — Production gates not verified with real identities

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | Checklist item: smoke `assertFiAdminShellAccess` with real `fi_users` + `fi_os_identities` rows — unverified until Evolved staff provisioned. |
| **Remediation priority** | P1 |
| **Evidence** | [fi-os-access-production.md](../fi-os-access-production.md); master checklist |
| **Mitigation (FI-PH1)** | Provision Evolved staff; run `pnpm run smoke:prod` post-deploy |

---

## Legacy API routes

### BLK-LEG-01 — `/api/fi/*` machine routes remain high blast-radius

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | Routes (`events`, `submit`, `uploads`, `cases`, `partners`, `run-model`) gated by `FI_LEGACY_FI_API_ENABLED` (default off) + single `FI_LEGACY_FI_API_SECRET`. When enabled, **High** prod risk per [api-routes-inventory.md](../security/api-routes-inventory.md). HairAudit/HLI ingest depends on this path today. |
| **Remediation priority** | P0 |
| **Evidence** | `legacyFiApiAuth.ts`; ecosystem audit §2.1 |
| **Mitigation (FI-PH1)** | Keep disabled unless HairAudit ingest required — then Bearer-only, rotate secret, IP allowlist |

### BLK-LEG-02 — Audit/report tenant APIs use parallel auth path

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Production impact** | `/api/fi/audit/*`, `/api/fi/report`, patient-twin use `checkFiTenantPortalApiAccess` — session required in production. Misconfigured preview env with `NODE_ENV=production` without sessions blocks audit workflows. |
| **Remediation priority** | P1 |
| **Evidence** | [api-routes-inventory.md](../security/api-routes-inventory.md); `insecureFiApiBypass.ts` |
| **Mitigation (FI-PH1)** | Verify session auth on production URL; never set `FI_ALLOW_INSECURE_API` in prod |

---

## Dual code roots

### BLK-DCR-01 — Split `lib/` and `src/lib/` event ingest paths

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | HTTP ingest authoritative schema in `lib/fi/events/schema.ts`; foundation dual-write in `src/lib/fi/foundation/dualWriteEvent.ts`; handlers in `lib/fi/events/handlers/*`. Changes require coordinated edits — drift causes ingest rejections or incomplete timeline writes. |
| **Remediation priority** | P2 |
| **Evidence** | [ecosystem-architecture-stabilization-audit.md](../ecosystem-architecture-stabilization-audit.md) §2.1 |
| **Mitigation (FI-PH1)** | No refactor during freeze; document pairing for any hotfix |

### BLK-DCR-02 — Split server actions (`lib/actions/` vs `src/lib/actions/`)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Production impact** | ~97 action files split across roots (e.g. CRM/booking in `lib/actions/`, Google Calendar sync review in `src/lib/actions/`). Import path inconsistency increases review burden and duplicate-pattern risk. |
| **Remediation priority** | P2 |
| **Evidence** | Repo glob inventory; design docs reference both paths |
| **Mitigation (FI-PH1)** | Follow existing file's root when patching; no moves during freeze |

### BLK-DCR-03 — Parallel imaging module paths (`src/lib/imaging-os/` vs `src/lib/imagingOs/`)

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Production impact** | IM-1 contracts under `imaging-os/`; guided capture UI under `imagingOs/` — documented in [imaging-os-architecture.md](../imaging-os-architecture.md). Operator confusion only; upload path uses PatientOS API. |
| **Remediation priority** | P3 |
| **Evidence** | Imaging architecture doc § Module Layout |
| **Mitigation (FI-PH1)** | Validation doc clarifies stub vs live capture |

---

## Additional cross-cutting blockers (from master checklist)

| ID | Item | Severity | Priority |
|----|------|----------|----------|
| BLK-X-01 | HubSpot inbound webhooks not in codebase | Medium | P3 (defer) |
| BLK-X-02 | Workflow engine v1 — placeholders only, not wired to ingest | Medium | P2 |
| BLK-X-03 | Parallel lead models (`fi_crm_leads` vs `fi_leads`) | Medium | P1 |
| BLK-X-04 | Surgery plan absent from patient timeline feed | Medium | P2 |
| BLK-X-05 | Analytics module publishers incomplete for full journey | Medium | P1 |

---

## Highest-risk production issues (summary)

| Rank | Blocker | Why it matters for Evolved |
|------|---------|----------------------------|
| 1 | BLK-SEC-01 + BLK-SEC-02 | No verified DR and cron/secrets → operational and data-loss risk |
| 2 | BLK-FIN-01 | Staff may assume live payments when only manual records exist |
| 3 | BLK-LEG-01 | HairAudit/HLI ingest tied to legacy API if cross-product path used |
| 4 | BLK-CAL-01 | Calendar sync does not auto-create bookings — scheduling gap |
| 5 | BLK-FIN-02 | Surgery may proceed without enforced deposit clearance |
| 6 | BLK-INT-01 | No production intelligence bus — downstream automation unavailable |
| 7 | BLK-SEC-03 | Service-role concentration — tenant filter regression = PHI leak |

---

## FI-PH1 Task 3 — delivered artifacts

Task 3 remediation control layer (FI-PH1):

- [P0/P1 remediation command centre](./fi-ph1-p0-p1-remediation-command-centre.md)
- [Go-live risk register](./evolved-go-live-risk-register.md)
- [Go/no-go checklist](./evolved-go-no-go-checklist.md)
- [Smoketest journey](./evolved-smoketest-journey.md)

## FI-PH1 Task 4 recommendation

**Proposed Task 4:** **Evolved production validation execution + blocker remediation sprint**

Execute the [operational validation framework](./evolved-operational-validation.md) against production (or production-parity) environment in the recommended cross-category order, using `SMOKETEST-` records and capturing evidence in the [workflow matrix](./evolved-workflow-matrix.md) template.

**Priority remediation bundle (P0/P1 only, no new features):**

1. **Infrastructure P0** — Complete backup/PITR + restore drill (BLK-SEC-01) or signed risk acceptance; rotate secrets; configure Vercel crons (BLK-SEC-02).
2. **Financial clarity P0** — Staff training artifact confirming manual `fi_payment_records` scope (BLK-FIN-01); manual surgery clearance checklist (BLK-FIN-02).
3. **Access verification P1** — Provision real Evolved `fi_users`; run `pnpm run check:env` + `pnpm run smoke:prod` (BLK-SEC-05).
4. **Calendar ops P1** — Document Evolved booking SOP excluding auto-create from Google staging (BLK-CAL-01); review sync health weekly (BLK-CAL-02).
5. **Reception pilot P1** — Confirm dry-run env; run `validate:reception-os` (BLK-REC-01).
6. **Legacy API decision P0/P1** — Explicit go/no-go on `FI_LEGACY_FI_API_ENABLED` for HairAudit ingest (BLK-LEG-01); default remain off unless required.

**Deliverables for Task 3:**

- Completed validation sign-off table (all 10 OS categories)
- Updated [readiness scorecard](./readiness-scorecard.md) ≥ 95/100 or documented deductions
- Blocker status column: Open / Mitigated / Accepted risk (with owner + date)
- Evolved staff sign-off on one end-to-end `SMOKETEST-` journey per FI-PH1 completion criteria

**Explicitly out of scope for Task 3 (architecture freeze):**

- Unified event bus activation
- Google staged → FI booking automation
- MedicationOS / AcademyOS feature completion
- HubSpot inbound webhooks
- Code root consolidation (`lib/` vs `src/lib/`)

---

## Change log

| Date | Change | Author |
|------|--------|--------|
| To verify | Initial FI-PH1 Task 2 blocker audit from codebase | — |
