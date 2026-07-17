# FI-WEB-REFRESH-1D — Demo / Platform and Migration Review

**Date:** 2026-07-16  
**Canonical route:** `/demo`  
**Depends on:** 1A messaging standard, 1B progress, 1C LeadFlow

---

## 1. Route and form audit

| Route | Before | After |
| --- | --- | --- |
| `/demo` | Placeholder “Book Enterprise Demo” + mailto | Full Platform and Migration Review page + structured form |
| `/contact` | Mailto channels only | Retained for general contact; enterprise demo intent links to `/demo` |
| Public form API | None | `POST /api/public/platform-review` |
| HubSpot public form | Not used on marketing site | Not introduced |
| Native FI LeadFlow public create | No public tenant lead endpoint | Not used (no dual-write) |

---

## 2. Canonical route decision

**Replace `/demo` content in place** (preferred).

Rationale:

- Many CTAs already point to `/demo`
- Avoids orphaning shared URLs
- `/contact` remains general correspondence; `/demo` is the structured enterprise enquiry

No separate `/migrate-from-hubspot` in this task (1G).

---

## 3. Submission destination decision

**Decision: A — Email notification to sales (continuity path)**

| Option | Chosen? | Notes |
| --- | --- | --- |
| A. Continue to HubSpot (form/API) | No public HubSpot form existed | |
| B. Native FI LeadFlow | No safe public tenant lead path | |
| C. Dual-write | Rejected — ownership/duplicates unclear | |
| **Email via Resend to sales@** | **Yes** | Continuity with prior `mailto:sales@…` demo path |

**Env:**

- `RESEND_API_KEY` (required in production)
- `RESEND_FROM_EMAIL` or `PLATFORM_REVIEW_FROM_EMAIL`
- Optional `PLATFORM_REVIEW_TO_EMAIL` / `SALES_INBOUND_EMAIL` (default `sales@follicleintelligence.ai`)

**Architecture is not exposed on the public page.**

---

## 4. Consent and privacy

- Required checkbox + link to `/privacy`
- Privacy page added (summary for public enquiries)
- Warning not to submit patient data / credentials

---

## 5. Duplicate and failure protection

- Client: disable while submitting; clear success state
- Server: honeypot field
- Server: IP rate limit (8/hour in-memory)
- Server: fingerprint (email + org + interest) 15-minute duplicate window
- Failure: 503 + user message to email sales@ if Resend unavailable

---

## 6. CTA updates (scoped)

| Location | Change |
| --- | --- |
| LeadFlow page CTAs | → Request review `/demo` |
| Platform Progress secondary CTA | → `/demo` |
| Platform page demo CTAs | label + `/demo` |
| Footer | “Platform review” → `/demo` |
| Contact intent card | structured form link |
| Structured data FAQs | wording |

Wider homepage CTA cleanup completed in **1E**.

---

## 7. Deferred

- HubSpot form dual-path if marketing ops requires CRM objects
- Native FI public lead intake with governance tenant
- Multi-step wizard form
- Dedicated migration page (1G)
