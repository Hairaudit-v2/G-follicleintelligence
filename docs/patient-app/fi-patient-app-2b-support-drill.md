# FI-PATIENT-APP-2B — Support and escalation tabletop

**Status:** Tabletop documented. Live joint drill with clinic owner **blocked** until clinic pilot owner is named and accepts L1.

## Support tiers

| Level | Owner | Scope | Timing promise |
| --- | --- | --- | --- |
| L1 | Clinic pilot owner / coordinator | Login, invite, journey/quote/doc/pathology questions | Clinic business hours — **do not promise 24/7** |
| L2 | FI pilot owner (Thelo) | Access, app errors, notifications, journey state | Agreed FI business hours |
| L3 | Engineering escalation (Thelo early dual seat) | Security, identity, cross-tenant, data repair, rollback | Security/identity: **immediate escalation** |

## Fallback

If app unavailable: clinic uses approved channel; staff retain FiOS journey; patient access can be paused/deactivated; communications leave the app.

## Scenarios (tabletop walkthrough)

1. Cannot log in → L1 verify invite/credentials → L2 session/token
2. Expired invitation → L1 re-issue process only after eligibility re-check; no reuse of withdrawn links
3. Notification wrong/unavailable action → L2 deep-link + journey state; suppress if safety
4. Stale action state → L2 refresh/FiOS SoR; L3 if mismatch persists
5. Quote superseded → L1 clinic messaging; app shows SoR state
6. Document unavailable → L1 provide alternate channel
7. Pathology completed clinic-side while app open → patient refresh; SoR wins
8. Withdrawal request → L1 confirm → operator withdraw (`patient_withdrawn`) → confirm no further push
9. Wrong identity suspected → **immediate L3**; pause tenant if needed; preserve evidence
10. App unavailable before required action → L1 fallback channel; journey continues in FiOS

## Closure

Each incident: owner, timeline, patient-safe outcome, whether pause required, evidence retained (gateway audit + ops log). No PHI in public docs.
