# FI-HUBSPOT-BACKUP-1 — Non-blocking backlog handoff

**Date:** 2026-07-16  
**Programme status:** Closed GREEN — COMPLETE (`evidence-fi-hubspot-backup-1-final-closeout.md`)  
**Purpose:** Separate follow-ups that must not reopen the completed backup programme.

None of these items is an unresolved recovery defect for FI-HUBSPOT-BACKUP-1.

---

## 1. FI-HUBSPOT-CONTACT-ASSOCIATION-ENRICHMENT-1

| Field | Value |
|-------|-------|
| Status | Open — non-blocking |
| Detail | Deterministic CSV Conversion ID ↔ Contact ID enrichment for 3,107 rows |
| Constraints | No email matching; no fuzzy/probabilistic matching |
| Record | `docs/audits/fi-hubspot-contact-association-enrichment-1-backlog.md` |

---

## 2. FI-HUBSPOT-INCREMENTAL-DATASET-EXPANSION-1

| Field | Value |
|-------|-------|
| Status | Open — future dataset expansion |
| Detail | Extend incremental backup beyond notes v1 |
| Constraints | Do not reopen notes v1 contract; preserve fixed UTC cutoffs and watermark-after-verification |

---

## 3. FI-HUBSPOT-ARCHIVED-NOTE-RECOVERY-1

| Field | Value |
|-------|-------|
| Status | Open — non-blocking follow-up |
| Detail | Strategy for archived notes outside the current HubSpot Search path |
| Constraints | Must not weaken live Search incremental path or watermark rules |

---

## 4. FI-ADMIN-NOTIFICATIONS-INTEGRATION-FK-GENERALISATION-1

| Field | Value |
|-------|-------|
| Status | Open — non-blocking follow-up |
| Detail | Generalise `fi_admin_notifications.integration_id` beyond calendar-specific FK |
| Current workaround | HubSpot integration identity stored in notification metadata (`source=hubspot_incremental_backup`) |

---

## 5. FI-HUBSPOT-OVERVIEW-SMOKE-FIXTURE-REFRESH-1

| Field | Value |
|-------|-------|
| Status | Open — test-maintenance item |
| Detail | Refresh overview production-smoke expected totals (stale 4,750 fixture) |
| Impact | Non-blocking for backup health / incremental ops |

---

## Recommended next product milestone

**FI-HUBSPOT-IMPORT-1 — Controlled HubSpot-to-FI OS migration**

Map verified HubSpot evidence into native FI OS entities without reopening FI-HUBSPOT-BACKUP-1.
