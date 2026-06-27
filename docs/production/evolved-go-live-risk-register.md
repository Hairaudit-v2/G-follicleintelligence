# Evolved Hair Restoration — Go-Live Risk Register

**Sprint:** FI-PH1 — Production Hardening  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Source:** [Evolved production blockers](./evolved-production-blockers.md) — all catalogued blockers; no invented items  
**Status:** Template — **To verify** until remediation evidence attached  
**Last updated:** To verify

**Related docs**

- [P0/P1 remediation command centre](./fi-ph1-p0-p1-remediation-command-centre.md)
- [Go/no-go checklist](./evolved-go-no-go-checklist.md)
- [Smoketest journey](./evolved-smoketest-journey.md)

**Severity legend:** Critical · High · Medium · Low  
**Likelihood legend:** High · Medium · Low · To verify  
**Go-live posture:** Block · Allow with mitigation · Allow · Accepted risk · To verify

---

## Risk register

| Risk ID | Category | Severity | Likelihood | Impact | Mitigation | Owner | Evidence required | Current status | Go-live posture |
|---------|----------|----------|------------|--------|------------|-------|-------------------|----------------|-----------------|
| BLK-SEC-01 | Security | Critical | Medium | Data loss; PHI unrecoverable; regulatory breach | Complete [backup/PITR](../runbooks/fi-os-supabase-backup-setup.md) + [storage restore drill](../runbooks/fi-os-storage-backup-restore-drill.md) or dated executive deferral | To verify | Drill log; PITR enabled proof; restore artifact | Not started | Block |
| BLK-SEC-02 | Security | High | Medium | Stale secrets; missed reminders; stale staff directory | Rotate secrets; configure Vercel cron (reminders + IIOHR); sprint change log | To verify | Change log; cron 200 logs; check:env pass | Not started | Block |
| BLK-SEC-03 | Security | High | Low | Cross-tenant PHI leak via `supabaseAdmin` without tenant filter | RLS spot-check; cross-tenant denial smoke; restrict `/fi-admin/system/*` usage | To verify | Smoke/e2e security output; admin inventory review | Not started | Allow with mitigation |
| BLK-SEC-04 | Security | Medium | Medium | PIN brute force; weak role on PatientOS mutations | PIN rotation policy; monitor `fi_staff_pin_audit`; master checklist should-fix items | To verify | Policy doc; audit sample | Not started | Allow with mitigation |
| BLK-SEC-05 | Security | Medium | Medium | Unverified auth gates for real Evolved staff | Provision `fi_users` + `fi_os_identities`; `pnpm run smoke:prod` | To verify | User provisioning record; smoke log | Not started | Block |
| BLK-LEG-01 | Legacy API | High | Low | High blast-radius if `FI_LEGACY_FI_API_ENABLED` on | Default off; explicit go/no-go; rotate secret + IP allowlist if enabled | To verify | Decision memo; env audit | Not started | Block |
| BLK-LEG-02 | Legacy API | High | Low | Audit workflows blocked if session auth misconfigured | Verify session on prod URL; never `FI_ALLOW_INSECURE_API` in prod | To verify | Session smoke on audit routes | Not started | Allow with mitigation |
| BLK-FIN-01 | Financial | High | High | Staff assume live payments; commercial/compliance error | Training + UI copy audit; manual records SOP | To verify | Staff sign-off | Not started | Block |
| BLK-FIN-02 | Financial | High | Medium | Surgery proceeds without deposit clearance | Manual clearance checklist before surgery book | To verify | SOP + smoketest steps 7–8 | Not started | Block |
| BLK-FIN-03 | Financial | Medium | Low | Stripe duplicate rows if webhook enabled without dedupe | Keep Stripe disabled for FI-PH1 unless dedupe verified | To verify | Stripe env off confirmation | Not started | Allow with mitigation |
| BLK-CAL-01 | Calendar | High | High | Scheduling gap — Google approve does not create FI bookings | FI-native SoR SOP; manual booking after staged review | To verify | Calendar SOP; staging probe | Not started | Allow with mitigation |
| BLK-CAL-02 | Calendar | Medium | Medium | Sync conflict backlog; calendar drift | Weekly sync health review; FI bookings authoritative | To verify | Weekly review log | Not started | Allow with mitigation |
| BLK-CAL-03 | Calendar | Medium | Low | Timely webhook replay if Evolved enables Timely | Confirm Timely N/A or monitor 401; idempotency deferred | To verify | Timely config audit | Not started | To verify |
| BLK-REC-01 | Reception | Medium | Medium | Accidental live SMS/email to patients | Verify dry-run default; `validate:reception-os` | To verify | Env audit; validation script output | Not started | Allow with mitigation |
| BLK-REC-02 | Reception | Low | Low | Config error across multi-gate live send flags | Keep all live flags off for FI-PH1 | To verify | Env audit | Not started | Allow |
| BLK-INT-01 | Intelligence Bus | High | Certain | No production bus automation or replay log | Acknowledge off; use CRM + `fi_analytics_events` | To verify | Signed acknowledgement | Not started | Allow with mitigation |
| BLK-INT-02 | Intelligence Bus | Medium | Low | Premature production dispatch without governance | Empty allow-list; no flag changes without governance pack | To verify | Env audit | Not started | Allow |
| BLK-INT-03 | Intelligence Bus | Medium | Medium | Event ingest rejections from vocabulary drift | Treat `lib/fi/events/schema.ts` as runtime truth | To verify | verify:fi-events if ingest used | Not started | Allow with mitigation |
| BLK-ACA-01 | AcademyOS | Medium | Medium | Unqualified staff on surgery team | Manual privilege check on procedure day | To verify | Procedure-day checklist | Not started | Allow with mitigation |
| BLK-ACA-02 | AcademyOS | Medium | Medium | Stale competency projections | Monitor `fi_competency_import_events`; HR sync health | To verify | Import event sample | Not started | Allow with mitigation |
| BLK-MED-01 | MedicationOS | Medium | Medium | Incomplete therapy timeline; Patient Twin skip | DoctorOS Rx SoR; MedicationOS pilot only | To verify | Training acknowledgement | Not started | Allow with mitigation |
| BLK-MED-02 | MedicationOS | Low | Medium | Confusion between therapy plan and prescription | Staff training — prescribing workspace only | To verify | Training note | Not started | Allow with mitigation |
| BLK-DCR-01 | Dual code roots | Medium | Low | Ingest rejections or incomplete timeline on hotfix | No refactor during freeze; document pairing for hotfixes | To verify | Hotfix runbook note | Not started | Allow |
| BLK-DCR-02 | Dual code roots | Medium | Low | Review burden; duplicate patterns across action roots | Follow existing file root when patching | To verify | — | Not started | Allow |
| BLK-DCR-03 | Dual code roots | Low | Low | Operator confusion imaging paths | Validation doc clarifies stub vs live capture | To verify | Imaging checklist row | Not started | Allow |
| BLK-X-01 | Cross-cutting | Medium | Low | HubSpot inbound not in codebase | Defer; import centre only | To verify | N/A confirmation for Evolved | Not started | Allow |
| BLK-X-02 | Cross-cutting | Medium | Low | Workflow engine placeholders not wired | Do not rely on engine for FI-PH1 automation | To verify | Checklist acknowledgement | Not started | Allow with mitigation |
| BLK-X-03 | Cross-cutting | Medium | Medium | Wrong lead model used by Evolved staff | Confirm whether Evolved uses `fi_crm_leads` vs `fi_leads` | To verify | SQL or CRM audit | Not started | To verify |
| BLK-X-04 | Cross-cutting | Medium | Medium | Surgery plan absent from patient timeline feed | Rely on case UI; document visibility gap | To verify | UI smoke note | Not started | Allow with mitigation |
| BLK-X-05 | Cross-cutting | Medium | High | Incomplete analytics for full journey | Acknowledge gaps; manual journey verification | To verify | Smoketest step 12 evidence | Not started | Allow with mitigation |

---

## Summary by go-live posture

| Posture | Count | Risk IDs |
|---------|------:|----------|
| **Block** | 6 | BLK-SEC-01, BLK-SEC-02, BLK-SEC-05, BLK-LEG-01, BLK-FIN-01, BLK-FIN-02 |
| **Allow with mitigation** | 16 | BLK-SEC-03, BLK-SEC-04, BLK-LEG-02, BLK-FIN-03, BLK-CAL-01, BLK-CAL-02, BLK-REC-01, BLK-INT-01, BLK-INT-03, BLK-ACA-01, BLK-ACA-02, BLK-MED-01, BLK-MED-02, BLK-X-02, BLK-X-04, BLK-X-05 |
| **Allow** | 6 | BLK-REC-02, BLK-INT-02, BLK-DCR-01, BLK-DCR-02, BLK-DCR-03, BLK-X-01 |
| **To verify** | 2 | BLK-CAL-03, BLK-X-03 |

*Counts reflect initial template posture from blocker audit — update when evidence changes status.*

---

## Highest-risk register items (Evolved focus)

| Rank | Risk ID | Why it matters |
|------|---------|----------------|
| 1 | BLK-SEC-01 + BLK-SEC-02 | No verified DR and cron/secrets → operational and data-loss risk |
| 2 | BLK-FIN-01 | Staff may assume live payments when only manual records exist |
| 3 | BLK-LEG-01 | HairAudit/HLI ingest tied to legacy API if cross-product path used |
| 4 | BLK-CAL-01 | Calendar sync does not auto-create bookings — scheduling gap |
| 5 | BLK-FIN-02 | Surgery may proceed without enforced deposit clearance |
| 6 | BLK-INT-01 | No production intelligence bus — downstream automation unavailable |
| 7 | BLK-SEC-03 | Service-role concentration — tenant filter regression = PHI leak |

---

## Change log

| Date | Change | Author |
|------|--------|--------|
| To verify | FI-PH1 Task 3 — go-live risk register created from blocker audit | — |
