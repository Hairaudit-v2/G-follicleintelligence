# Stage 7A.4 — Curated Excel service catalogue → FI approved seed

- **Generated:** 2026-06-07T22:57:40.254Z
- **Source Excel:** docs/timely-import/input/evolved-fi-services-catalogue-draft (1).xlsx

## Summary

| Metric | Count |
|--------|------:|
| **Approved rows** (`approved_for_import`) | 29 |
| **Active** (`is_active: true`) | 29 |
| **Inactive in approved list** | 0 |
| **Removed (non-bookable)** | 2 |
| **Rejected (validation)** | 0 |
| **Rejected — missing name** | 0 |
| **Rejected — missing / invalid duration** | 0 |
| **Not imported (not Yes)** | 0 |

## Warnings
- Duplicate booking_type "consultation": keeping "Hair Transplant Consultation" (Excel row 2); cleared on "Virtual Hair Transplant Consultation" (Excel row 3).
- Duplicate booking_type "consultation": keeping "Hair Transplant Consultation" (Excel row 2); cleared on "Phone Consultation" (Excel row 4).
- Duplicate booking_type "consultation": keeping "Hair Transplant Consultation" (Excel row 2); cleared on "PRP / Mesotherapy Consultation" (Excel row 5).
- Duplicate booking_type "consultation": keeping "Hair Transplant Consultation" (Excel row 2); cleared on "Trichological Examination" (Excel row 6).
- Duplicate booking_type "consultation": keeping "Hair Transplant Consultation" (Excel row 2); cleared on "Blood Test Review" (Excel row 7).
- Duplicate booking_type "consultation": keeping "Hair Transplant Consultation" (Excel row 2); cleared on "Surgeon Pre-Surgery Consultation" (Excel row 8).
- Duplicate booking_type "follow_up": keeping "1 Week Follow-Up" (Excel row 9); cleared on "1 Month Follow-Up" (Excel row 10).
- Duplicate booking_type "follow_up": keeping "1 Week Follow-Up" (Excel row 9); cleared on "3 Month Follow-Up" (Excel row 11).
- Duplicate booking_type "follow_up": keeping "1 Week Follow-Up" (Excel row 9); cleared on "6 Month Follow-Up" (Excel row 12).
- Duplicate booking_type "follow_up": keeping "1 Week Follow-Up" (Excel row 9); cleared on "9 Month Follow-Up" (Excel row 13).
- Duplicate booking_type "follow_up": keeping "1 Week Follow-Up" (Excel row 9); cleared on "12 Month Follow-Up" (Excel row 14).
- Duplicate booking_type "follow_up": keeping "1 Week Follow-Up" (Excel row 9); cleared on "18 Month Follow-Up" (Excel row 15).
- Duplicate booking_type "prp": keeping "PRP Single Session" (Excel row 16); cleared on "PRP 3 Session Package" (Excel row 17).
- Duplicate booking_type "prp": keeping "PRP Single Session" (Excel row 16); cleared on "PRP 6 Session Package" (Excel row 18).
- Duplicate booking_type "prp": keeping "PRP Single Session" (Excel row 16); cleared on "Facial PRP" (Excel row 19).
- Duplicate booking_type "mesotherapy": keeping "Mesotherapy Single Session" (Excel row 21); cleared on "Dutasteride Mesotherapy" (Excel row 22).
- Duplicate booking_type "surgery": keeping "Hair Transplant Full Day" (Excel row 24); cleared on "Hair Transplant Two Day Session" (Excel row 25).
- Duplicate booking_type "surgery": keeping "Hair Transplant Full Day" (Excel row 24); cleared on "Small Hair Transplant Session" (Excel row 26).
- Duplicate booking_type "surgery": keeping "Hair Transplant Full Day" (Excel row 24); cleared on "Eyebrow Transplant" (Excel row 27).
- Duplicate booking_type "surgery": keeping "Hair Transplant Full Day" (Excel row 24); cleared on "Beard Transplant" (Excel row 28).
- Duplicate booking_type "consultation": keeping "Hair Transplant Consultation" (Excel row 2); cleared on "Hair Transplant Repair Consultation" (Excel row 29).
- Duplicate booking_type "surgery": keeping "Hair Transplant Full Day" (Excel row 24); cleared on "Hair Transplant Repair Surgery" (Excel row 30).

## Duplicate booking types
Non-null `booking_type` must be unique per tenant in `fi_services`. Duplicate types in the Excel sheet had `booking_type` cleared on non-canonical rows (see `review_flags` / `curation_notes` on those rows).

## Approved services (ready for Stage 7A.3 dry-run)
- **Hair Transplant Consultation** — Consultation; `booking_type`: consultation; 60 min; AUD 50; colour #2563eb; active=true
  - *Note:* Excel notes: Core face-to-face consultation for transplant assessment.
- **Virtual Hair Transplant Consultation** — Consultation; `booking_type`: —; 30 min; AUD 0; colour #2563eb; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Zoom/telehealth consultation. booking_type cleared: duplicate "consultation" in Excel catalogue — canonical row is "Hair Transplant Consultation" (Excel row 2).
- **Phone Consultation** — Consultation; `booking_type`: —; 30 min; AUD 0; colour #2563eb; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Initial phone consultation or short assessment. booking_type cleared: duplicate "consultation" in Excel catalogue — canonical row is "Hair Transplant Consultation" (Excel row 2).
- **PRP / Mesotherapy Consultation** — Consultation; `booking_type`: —; 30 min; AUD 25; colour #2563eb; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: For PRP, mesotherapy, exosomes, dutasteride pathway discussion. booking_type cleared: duplicate "consultation" in Excel catalogue — canonical row is "Hair Transplant Consultation" (Excel row 2).
- **Trichological Examination** — Diagnostics; `booking_type`: —; 60 min; AUD 89; colour #0f766e; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Detailed scalp and hair-loss assessment. booking_type cleared: duplicate "consultation" in Excel catalogue — canonical row is "Hair Transplant Consultation" (Excel row 2).
- **Blood Test Review** — Diagnostics; `booking_type`: —; 30 min; AUD 0; colour #0f766e; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Review bloods and treatment plan. booking_type cleared: duplicate "consultation" in Excel catalogue — canonical row is "Hair Transplant Consultation" (Excel row 2).
- **Surgeon Pre-Surgery Consultation** — Consultation; `booking_type`: —; 30 min; AUD 140; colour #2563eb; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Pre-surgery review and surgical consent planning. booking_type cleared: duplicate "consultation" in Excel catalogue — canonical row is "Hair Transplant Consultation" (Excel row 2).
- **1 Week Follow-Up** — Follow-up; `booking_type`: follow_up; 15 min; AUD 0; colour #7c3aed; active=true
  - *Note:* Excel notes: Post-procedure wound/scab review.
- **1 Month Follow-Up** — Follow-up; `booking_type`: —; 20 min; AUD 0; colour #7c3aed; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Early post-op or treatment review. booking_type cleared: duplicate "follow_up" in Excel catalogue — canonical row is "1 Week Follow-Up" (Excel row 9).
- **3 Month Follow-Up** — Follow-up; `booking_type`: —; 30 min; AUD 0; colour #7c3aed; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Growth/treatment review. booking_type cleared: duplicate "follow_up" in Excel catalogue — canonical row is "1 Week Follow-Up" (Excel row 9).
- **6 Month Follow-Up** — Follow-up; `booking_type`: —; 30 min; AUD 0; colour #7c3aed; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Midpoint review and photo comparison. booking_type cleared: duplicate "follow_up" in Excel catalogue — canonical row is "1 Week Follow-Up" (Excel row 9).
- **9 Month Follow-Up** — Follow-up; `booking_type`: —; 30 min; AUD 0; colour #7c3aed; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Progress review where applicable. booking_type cleared: duplicate "follow_up" in Excel catalogue — canonical row is "1 Week Follow-Up" (Excel row 9).
- **12 Month Follow-Up** — Follow-up; `booking_type`: —; 45 min; AUD 0; colour #7c3aed; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Final growth/result review. booking_type cleared: duplicate "follow_up" in Excel catalogue — canonical row is "1 Week Follow-Up" (Excel row 9).
- **18 Month Follow-Up** — Follow-up; `booking_type`: —; 45 min; AUD 0; colour #7c3aed; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Extended review for slower growth or complex cases. booking_type cleared: duplicate "follow_up" in Excel catalogue — canonical row is "1 Week Follow-Up" (Excel row 9).
- **PRP Single Session** — Treatment; `booking_type`: prp; 45 min; AUD 320; colour #dc2626; active=true
  - *Note:* Excel notes: Single scalp PRP treatment.
- **PRP 3 Session Package** — Treatment; `booking_type`: —; 45 min; AUD 860; colour #dc2626; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Package item; consider whether bookable directly or sold as package only. booking_type cleared: duplicate "prp" in Excel catalogue — canonical row is "PRP Single Session" (Excel row 16).
- **PRP 6 Session Package** — Treatment; `booking_type`: —; 45 min; AUD 1500; colour #dc2626; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Package item; consider whether bookable directly or sold as package only. booking_type cleared: duplicate "prp" in Excel catalogue — canonical row is "PRP Single Session" (Excel row 16).
- **Facial PRP** — Treatment; `booking_type`: —; 60 min; AUD 400; colour #dc2626; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* booking_type alias: facial_prp → prp (FI schema). Excel notes: Facial regenerative PRP treatment. booking_type cleared: duplicate "prp" in Excel catalogue — canonical row is "PRP Single Session" (Excel row 16).
- **Exosome Therapy** — Treatment; `booking_type`: exosomes; 45 min; AUD 450; colour #ea580c; active=true
  - *Note:* Excel notes: Scalp exosome treatment.
- **Mesotherapy Single Session** — Treatment; `booking_type`: mesotherapy; 45 min; AUD 320; colour #ea580c; active=true
  - *Note:* Excel notes: Scalp mesotherapy treatment.
- **Dutasteride Mesotherapy** — Treatment; `booking_type`: —; 45 min; AUD 200; colour #ea580c; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Confirm prescribing/clinical governance before enabling patient-facing booking. booking_type cleared: duplicate "mesotherapy" in Excel catalogue — canonical row is "Mesotherapy Single Session" (Excel row 21).
- **LED Therapy** — Treatment; `booking_type`: other; 30 min; AUD 20; colour #059669; active=true
  - *Note:* booking_type alias: led → other (FI schema). Excel notes: LED session.
- **Hair Transplant Full Day** — Surgery; `booking_type`: surgery; 480 min; AUD 12000; colour #111827; active=true
  - *Note:* Excel notes: Main full-day transplant session.
- **Hair Transplant Two Day Session** — Surgery; `booking_type`: —; 960 min; AUD 17000; colour #111827; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Two-day case; may be represented as two bookings in calendar. booking_type cleared: duplicate "surgery" in Excel catalogue — canonical row is "Hair Transplant Full Day" (Excel row 24).
- **Small Hair Transplant Session** — Surgery; `booking_type`: —; 240 min; AUD 500; colour #111827; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Small correction / partial-day session. booking_type cleared: duplicate "surgery" in Excel catalogue — canonical row is "Hair Transplant Full Day" (Excel row 24).
- **Eyebrow Transplant** — Surgery; `booking_type`: —; 360 min; AUD 5500; colour #111827; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Dedicated eyebrow transplant service. booking_type cleared: duplicate "surgery" in Excel catalogue — canonical row is "Hair Transplant Full Day" (Excel row 24).
- **Beard Transplant** — Surgery; `booking_type`: —; 420 min; AUD 8000; colour #111827; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Dedicated beard / facial hair transplant service. booking_type cleared: duplicate "surgery" in Excel catalogue — canonical row is "Hair Transplant Full Day" (Excel row 24).
- **Hair Transplant Repair Consultation** — Consultation; `booking_type`: —; 60 min; AUD 0; colour #2563eb; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Consultation for previous transplant repair. booking_type cleared: duplicate "consultation" in Excel catalogue — canonical row is "Hair Transplant Consultation" (Excel row 2).
- **Hair Transplant Repair Surgery** — Surgery; `booking_type`: —; 480 min; AUD 0; colour #111827; active=true
  - *Flags:* duplicate_booking_type_cleared
  - *Note:* Excel notes: Repair or density correction surgery. booking_type cleared: duplicate "surgery" in Excel catalogue — canonical row is "Hair Transplant Full Day" (Excel row 24).

## Rejected rows
_None._

## Not imported (Import? ≠ Yes)
_None._

## Removed (non-bookable)
- **Deposit / Booking Fee** — Excel row marked "Review" — non-bookable / financial per catalogue notes.
- **Retail Product Sale** — Excel row marked "Review" — non-bookable / financial per catalogue notes.

## Next step
Run `npm run import:approved-services` with `--tenant-id` (dry-run) against `docs/timely-import/output/fi-services-seed-approved.json` — **no DB writes in Stage 7A.4.**