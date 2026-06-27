# FI-PH1 — Production Hardening Sprint

**Sprint code:** FI-PH1  
**Status:** Active foundation — documentation only (no application code changes in this task)  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Start date:** To verify  
**Duration:** 30 calendar days

**Related docs**

- [P0/P1 remediation command centre](./fi-ph1-p0-p1-remediation-command-centre.md) — blocker execution and evidence
- [Go-live risk register](./evolved-go-live-risk-register.md) — all catalogued blockers
- [Go/no-go checklist](./evolved-go-no-go-checklist.md) — executive decision gate
- [Smoketest journey](./evolved-smoketest-journey.md) — end-to-end SMOKETEST template
- [Evolved production checklist](./evolved-production-checklist.md) — per-workflow validation
- [Readiness scorecard](./readiness-scorecard.md) — weighted go/no-go scoring (95/100 target)
- [FI OS production readiness](../runbooks/fi-os-production-readiness.md)
- [Production hardening master checklist](../runbooks/fi-os-production-hardening-master-checklist.md)
- [Production release checklist](../runbooks/fi-os-production-release-checklist.md)
- [Clinic operational readiness smoke](../smoke/fi-os-clinic-readiness-runbook.md)
- [Platform architecture registry](../platform-architecture/README.md)

---

## Sprint objective

Move **Evolved Hair Restoration** from **development partner** to the **first fully operational production tenant** on Follicle Intelligence OS.

Success means Evolved staff can run day-to-day clinic workflows — lead intake through reception, consultation, patient record, imaging, surgery coordination, and financial tracking — with production-grade access control, monitoring, and documented pass/fail evidence. No new product modules; no speculative features.

---

## Production tenant

| Field | Value |
|-------|-------|
| **Clinic** | Evolved Hair Restoration (Perth) |
| **Tenant env var** | `EVOLVED_PERTH_TENANT_ID` — UUID of `fi_tenants.id` for Evolved Perth |
| **Timezone expectation** | `Australia/Perth` for operational calendar windows (see [production readiness §1](../runbooks/fi-os-production-readiness.md)) |
| **HR / staff sync** | IIOHR Perth staff feed → [`docs/iiohr-hr-perth-staff-sync-cron.md`](../iiohr-hr-perth-staff-sync-cron.md) |
| **Reception pilot** | [`docs/runbooks/reception-os-production-readiness.md`](../runbooks/reception-os-production-readiness.md) |

**To verify:** Confirm `EVOLVED_PERTH_TENANT_ID` in production Vercel env matches the UUID shown in FI Admin for Evolved Perth. Do not copy UUIDs from docs or env examples into tickets — read from the live tenant record.

---

## 30-day scope

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | Foundation & access | Env audit, migration parity, auth gates, smoke baseline (`pnpm run smoke:prod`), scorecard initial score |
| **Week 2** | Workflow validation | Complete [Evolved production checklist](./evolved-production-checklist.md) sections LeadFlow → ConsultationOS |
| **Week 3** | Clinical & revenue paths | Checklist sections PatientOS → FinancialOS; imaging and surgery day dry-runs |
| **Week 4** | Security, monitoring, sign-off | Security audit items, monitoring dashboards, scorecard ≥ 95/100, release checklist sign-off |

Out of scope for FI-PH1: new OS modules, UI redesign, HubSpot/Meta net-new integrations, automated Stripe billing (see [production readiness — commercial non-scope](../runbooks/fi-os-production-readiness.md)).

---

## Freeze rules

During FI-PH1:

1. **Feature freeze** — No new user-facing capabilities unless required to unblock a **workflow safety** or **data integrity** defect found during validation.
2. **Schema freeze** — No discretionary migrations; only migrations already required by the release branch or blocking a validated workflow.
3. **Tenant freeze** — Evolved Perth is the sole production tenant for this sprint; do not provision additional production tenants until FI-PH1 sign-off.
4. **Config freeze** — Production env var changes require entry in the sprint change log (date, variable, reason, approver).
5. **Documentation freeze (final 3 days)** — Checklist and scorecard updates only; no drive-by doc rewrites outside FI-PH1 artifacts.

---

## Allowed work

- Production hardening: auth, RLS, cron/webhook hygiene, env validation, error sanitisation
- Workflow validation and evidence capture (screenshots, SQL read-only probes, smoke output)
- Bug fixes for **confirmed** production blockers on Evolved workflows
- Runbook and checklist updates under `docs/production/` and linked runbooks
- Operational configuration: Vercel cron, Supabase Auth redirect URLs, Resend domain, dry-run ReceptionOS flags
- Manual verification using `SMOKETEST-` prefixed demo data per [clinic readiness runbook](../smoke/fi-os-clinic-readiness-runbook.md)

---

## Forbidden work

- New modules or major feature epics (LeadFlow LF-4+, net-new FinancialOS phases, etc.)
- Speculative AI, analytics, or intelligence network activation
- UI redesign, navigation restructure, or design-system changes not required for workflow safety
- HubSpot inbound webhooks (not in codebase — see [master checklist](../runbooks/fi-os-production-hardening-master-checklist.md))
- Treating manual `fi_payment_records` as live payment processing (see [production readiness](../runbooks/fi-os-production-readiness.md))
- Production data exports to unsecured environments
- Skipping checklist items with assumed pass — mark **To verify** until evidence exists

---

## Weekly structure

### Week 1 — Foundation

- [ ] Run `pnpm run check:env` with production-like variables
- [ ] Run `pnpm run smoke:prod` against production `FI_BASE_URL` + `FI_SMOKE_TENANT_ID`
- [ ] Confirm migration list matches [production readiness §2](../runbooks/fi-os-production-readiness.md)
- [ ] Verify `NODE_ENV=production` gates per [`docs/fi-os-access-production.md`](../fi-os-access-production.md)
- [ ] Initial [readiness scorecard](./readiness-scorecard.md) baseline

### Week 2 — Front office & consultation

- [ ] LeadFlow + CalendarOS checklist sections — evidence attached
- [ ] ConsultationOS checklist — forms and booking linkage
- [ ] ReceptionOS pilot with dry-run communication (recommended)

### Week 3 — Clinical & financial

- [ ] PatientOS + ImagingOS checklist sections
- [ ] SurgeryOS procedure-day validation (team + milestones migration awareness)
- [ ] FinancialOS manual payment / deposit workflow (operational visibility only)

### Week 4 — Hardening & sign-off

- [ ] Security + Monitoring checklist sections
- [ ] Master checklist open items triaged (must-fix vs defer)
- [ ] Scorecard ≥ **95/100**
- [ ] [Production release checklist](../runbooks/fi-os-production-release-checklist.md) signed for ongoing ops

---

## Completion criteria

FI-PH1 is **complete** when all of the following are true:

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | [Readiness scorecard](./readiness-scorecard.md) total ≥ **95/100** | Signed scorecard with date and owner |
| 2 | Every workflow in [Evolved production checklist](./evolved-production-checklist.md) has **Pass** or documented **Accepted risk** with owner | Checklist PDF/export in sprint folder |
| 3 | `pnpm run smoke:prod` passes post-deploy on production URL | CI log or manual run output |
| 4 | No open **Must fix before production** items in [master checklist](../runbooks/fi-os-production-hardening-master-checklist.md) that block Evolved workflows | Master checklist review |
| 5 | Production access documented and verified — real `fi_users` + `fi_os_identities` rows | [`fi-os-access-production.md`](../fi-os-access-production.md) checks 5–7 |
| 6 | Backup / PITR and restore drill status documented (complete or dated deferral with risk acceptance) | [Supabase backup setup](../runbooks/fi-os-supabase-backup-setup.md), [storage drill](../runbooks/fi-os-storage-backup-restore-drill.md) |
| 7 | Evolved staff sign-off on at least one end-to-end path: lead → consult → patient → deposit record → booking | Named approver + date |

---

## Sprint change log

| Date | Change | Owner | Approved by |
|------|--------|-------|-------------|
| To verify | FI-PH1 foundation docs created | — | — |

---

## Escalation

| Severity | Examples | Action |
|----------|----------|--------|
| **P0** | Cross-tenant data exposure, auth bypass, PHI leak | Stop deploy; fix before any further validation |
| **P1** | Evolved workflow blocked (cannot book, cannot save consult, payment record corruption) | Fix within sprint; update checklist failure notes |
| **P2** | Degraded UX, non-blocking integration lag | Document; scorecard deduction; schedule post-PH1 |
| **P3** | Cosmetic, deferrable master-checklist items | Log in master checklist **Can defer** |
