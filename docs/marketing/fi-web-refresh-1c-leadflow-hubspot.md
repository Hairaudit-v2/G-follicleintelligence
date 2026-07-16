# FI-WEB-REFRESH-1C — LeadFlow and HubSpot migration positioning

**Date:** 2026-07-16  
**Depends on:** FI-WEB-REFRESH-1A, FI-WEB-REFRESH-1B (`6d19a45ae99ec34df5c713f6f3c0cf24306f3f3e`)  
**Route:** `/platform/leadflow`

---

## 1. Before → after structure

| Before | After |
| --- | --- |
| Short “LeadFlow / capture nurture convert” hero | Connected journey hero + Operational Pilot maturity |
| “Book Demo” CTAs | Discuss transition · Explore platform · Platform progress |
| Generic CRM gap one-liner | Clinic problem grid + CRM-stops-at-booking insight |
| Six undifferentiated capability cards | Capabilities with Operational Pilot / Expanding / Future |
| One sentence “connects to ConsultationOS” | Visual Enquiry → … → Outcome journey + module links |
| No HubSpot story | Connect / Coexist / Transition / Replace |
| No migration safeguards | Controlled transition checklist (public-safe) |
| Conversion CTA “lifelong patients” | Progressive adoption closing |

---

## 2. Capability classification

| Claim / capability | Classification | Evidence basis |
| --- | --- | --- |
| Website/campaign enquiry capture | Operational Pilot | CRM/pipeline intake, LeadFlow dashboards |
| Source / attribution | Operational Pilot | Lead source fields, pipeline diagnostics |
| Enquiry triage | Operational Pilot | Operator dashboard priority / attention surfaces |
| Pipeline stages | Operational Pilot | `fi_crm_pipeline_stages`, pipeline UI, e2e |
| Ownership / assignment | Operational Pilot | Lead owner fields, assignment workflows |
| Follow-up tasks / activity | Operational Pilot | Follow-up tasks, activity feed |
| Consultation progression | Operational Pilot | Handoff into consultation pathways / bookings |
| Converted / lost review | Operational Pilot | Pipeline stage volume and stage movement |
| Connection into patient record | Operational Pilot | Lead → person/patient spine in FI OS |
| HubSpot connect + event path | Operational Pilot | Webhook, event drain, operator HubSpot status |
| Staged HubSpot transition | Operational Pilot | Onboarding staged import, preview, duplicate checks, pilots 1D/1E |
| Referral tracking | Expanding | Referral fields exist; partner depth still expanding |
| Communication automation depth | Expanding | Tasks operational; sequences/multi-channel depth expanding |
| Full revenue-linked conversion ROI | Expanding / Future | Partial operational reporting; full outcome-linked ROI not claimed |
| Cross-journey outcome intelligence questions | Future | Strategic value of OS; not fully operational product claims |
| Chatbot as first-class channel | Unsupported as operational claim | Softened out of operational capability list |
| Instant full HubSpot replacement | Unsupported | Explicitly scoped; replace only within agreed scope |
| Zero-risk / one-click migration | Unsupported | Not used |

---

## 3. HubSpot relationship model (public)

| Mode | Wording on page |
| --- | --- |
| Connect | Selected data/workflows remain connected between HubSpot and FI |
| Coexist | Operate alongside during agreed adoption period |
| Transition | Selected contacts/leads/workflows move in verified stages |
| Replace | FI becomes primary CRM/ops within agreed scope |

Clinic line: **Connect, transition or replace — at a pace that protects clinic continuity.**

---

## 4. Migration claims included (public-safe)

- Historical backup before migration  
- Preview before application  
- Staged migration groups  
- Existing patient and lead matching  
- Duplicate prevention  
- Patient-record protection  
- Post-migration verification  
- Auditable migration history  
- Continued operation during staged transition  

**Not published:** batch IDs, checksums, table names, tenant IDs, cohort identities, patient data, gate names, “zero risk”, “one-click”, “fully reversible”.

---

## 5. Claims removed or softened (vs prior LeadFlow page)

| Prior | Treatment |
| --- | --- |
| “Capture, nurture and convert every patient enquiry” | Softened — connected journey framing |
| “Task Automation” / triggers that “nothing slips” | Softened to follow-up tasks; automation depth Expanding |
| “Follow-Up Engine” sequences | Softened; sequences Expanding |
| “Conversion Intelligence” revenue-linked | Softened; deeper intelligence Future |
| Chatbot conversations as core | Removed from operational capability list |
| Book Demo as sole CTA | Replaced with transition + platform CTAs |
| LeadFlow as standalone CRM product | Explicitly FI OS acquisition layer |

---

## 6. Metadata

- Title: `LeadFlow | Hair Restoration CRM and Patient Acquisition | Follicle Intelligence`  
- Description: progressive HubSpot + connected journey (search-length)  
- OG/Twitter: acquisition connected to patient journey  

---

## 7. Consistency corrections outside LeadFlow page

- `platformPageContent.ts` LeadFlow module blurb  
- `clinicOwnersPageContent.ts` LeadFlow band summary  
- `homePageContent.ts` V5 LeadFlow one-liner  

Homepage full refresh deferred to **1E**.

---

## 8. Deferred to FI-WEB-REFRESH-1G

- Dedicated `/migrate-from-hubspot` (or equivalent) page  
- Deeper migration FAQ, enterprise scoping form fields  
- Detailed object-coverage matrix (public-safe)  
- Case study / pilot narrative if approved  
- Link target swap from LeadFlow HubSpot section → dedicated migration page  

---

## 9. Final public copy source

Canonical copy lives in `lib/marketing/leadFlowPageContent.ts` and is rendered by `components/platform/LeadFlowMarketingView.tsx`.
