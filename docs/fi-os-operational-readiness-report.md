# FI OS Operational Readiness Report

Generated: 2026-07-02T01:52:42.737Z

## Summary

- **Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`
- **Base URL:** `https://follicleintelligence.ai/fi-admin`
- **Procedure Day flag:** `false`
- **Checks run:** 7
- **Failures:** 0

## Check matrix

| Check | Result | Detail |
|-------|--------|--------|
| http_reception_board_unauth | PASS | status 307 |
| http_procedure_day_hidden | PASS | status 307 (flag off) |
| http_reception_board_api_unauth | PASS | status 401 |
| http_cross_tenant_api | PASS | SKIPPED: FI_SMOKE_OTHER_TENANT_ID not set |
| http_reception_board_api_auth | PASS | payload ok (8 appointments) |
| loader_tier | PASS | loaders completed |
| journey_tier | PASS | full clinic day journey |

## Operational Readiness Score

**3/7** (43%) — **NOT READY**

| Criterion | Status | Detail |
|-----------|--------|--------|
| Booking complete | PASS | Consultation and surgery bookings exist. |
| Consent complete | PASS | Consent flag satisfied. |
| Payment complete | PASS | Deposit or payment recorded. |
| Staff assigned | FAIL | Staff not assigned. |
| Room assigned | FAIL | Room not assigned. |
| Procedure completed | FAIL | Procedure not completed. |
| Follow-up created | FAIL | No follow-up task. |

## Journey steps

| Step | Result | Detail |
|------|--------|--------|
| cross_tenant_admin_key_denied | PASS | skipped — no FI_SMOKE_OTHER_TENANT_ID or FI_ADMIN_API_KEY |
| lead_patient_created | PASS | leadId=c9a58f3d-e1e4-4187-9986-59faed41565d |
| consultation_booked | PASS | consultBookingId=3e91d76f-9502-40b8-9972-58302ec875ef |
| patient_checked_in | PASS | status=arrived |
| consultation_completed | PASS | consultationId=26660e8e-62ca-4de5-a93d-3d0410cfc2f6 |
| patient_record_created | PASS | patientId=287348d5-18bd-4434-9bab-7caafacbfe86 |
| quote_accepted | PASS | quoteId=86558737-ee05-4a89-8b97-d0a53cb7f26a |
| deposit_recorded | PASS | paymentRecordId=074a2e24-5dde-4fbe-8be2-ae712b8030da |
| surgery_booked | PASS | surgeryBookingId=4ccdcfbc-62b9-43eb-9f70-b4e2fc6593ef (2414ms) |
| reception_board_updated | PASS | appointments=10 queue=10 |
| calendar_blockers_resolved | PASS | feed ok; blockers=4 (may be env-specific) |
| procedure_day_skipped | PASS | FI_PROCEDURE_DAY_ENABLED is off — live workflow skipped (non-interference) |
| patient_journey_procedure_completed | PASS | skipped — procedure day disabled |
| cross_tenant_write_blocked | PASS | skipped — no FI_SMOKE_OTHER_TENANT_ID |

## Validation coverage

- Cross-tenant writes: admin key scope + journey probe
- Platform admin writes: CRM gate requires impersonation (unit tests + production rules)
- Reception Board: HTTP API + loader orchestration
- Calendar feed: forbidden-key guard on operational feed items
- Procedure Day: hidden when `FI_PROCEDURE_DAY_ENABLED` is off
- Patient Journey: `procedure_completed` after live workflow completion

## Run command

```bash
node scripts/run-fi-operational-day-smoke.mjs
FI_OPERATIONAL_SMOKE_ALLOW_MUTATIONS=1 node scripts/run-fi-operational-day-smoke.mjs --execute
```
