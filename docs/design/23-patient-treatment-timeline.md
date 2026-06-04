# Stage 4D — Patient treatment timeline

## Purpose

The patient treatment timeline is a **read-only, staff-only** longitudinal view on the FI Admin patient profile. It aggregates existing CRM, booking, case, clinical, imaging, and patient-admin signals into one chronological story—the first slice of the **patient digital twin** narrative inside FI OS—without introducing a new patient-native write model.

## Timeline sources

| Source | Events surfaced |
| --- | --- |
| `fi_crm_leads` | Lead linked (`lead_created`), conversion timestamp (`lead_converted`) |
| `fi_crm_activity_events` | Tasks, notes, communications, stage changes, booking updates, messages (as **sanitised** labels only) |
| `fi_bookings` | Scheduled (row `created_at`), completed, cancelled, no-show |
| `fi_cases` | Case created |
| `fi_patient_clinical_details` | Recorded / updated timestamps only (no free-text narrative in the timeline) |
| `fi_patient_images` | Upload and archive moments; category label only (no caption text) |
| `fi_patients` | Admin/status metadata change marker when `updated_at` differs from `created_at` (no `admin_note` body) |

## Safety rules

- **No clinical narrative**, **no admin note text**, and **no message / communication bodies** appear in titles, subtitles, or `metadata_summary`.
- CRM activity uses **kind-based labelling**; database `title` fields are not trusted for display (custom activity kinds could embed unsafe text).
- Booking **titles** are not shown on timeline cards (titles may contain PHI).
- Sensitive CRM kinds (notes, communications, message previews) set `is_sensitive` so the UI can avoid secondary previews.
- Thumbnails use **existing signed URLs** from the Stage 4C profile bundle for active images only; archived images have no inline preview in the timeline.

## Item types

Canonical `item_type` values: `lead_created`, `lead_converted`, `crm_activity`, `booking_scheduled`, `booking_completed`, `booking_cancelled`, `case_created`, `clinical_details_updated`, `image_uploaded`, `image_archived`, `patient_admin_updated`, `other`.

Each item also carries `source_type`, `source_id`, optional `href` (lead, case, calendar deep-link for bookings), optional `severity`, and `metadata_summary` (short, non-clinical).

## Intentionally deferred

- Patient-native activity authoring, timeline editing, drag-and-drop, and patient-facing timelines.
- AI analysis, HairAudit scoring, HLI diagnostics, surgery planning, and prescription workflows.
- Unlimited CRM history (profile loader caps raw activity rows; timeline defaults to the latest 100 aggregated items).

## Digital twin alignment

The timeline connects **operational** and **clinical-structure** events across modules while keeping clinical depth in dedicated surfaces (clinical details card, imaging vault, CRM lead drill-down). Later stages can enrich the same item model with model outputs and surgical milestones without rewriting the aggregation contract.
