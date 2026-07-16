# FI-WEB-REFRESH-1G — HubSpot migration page and final public pathway

**Date:** 2026-07-16  
**Canonical route:** `/migrate-from-hubspot`  
**Redirect:** `/platform/migrate-from-hubspot` → permanent redirect to canonical  

---

## Route decision

**Chosen:** `/migrate-from-hubspot` (top-level, SEO-friendly, not nested under product modules).

**Rejected dual publish:** nested path only as redirect.

---

## Capability audit (public matrix evidence)

Based on completed FI-HUBSPOT-BACKUP and FI-HUBSPOT-IMPORT stages (1A–1E):

| Public category | Status | Evidence basis |
| --- | --- | --- |
| Contacts / lead linkage | Supported | Staged import, preview, 1D pilot link-only, 1E expansion |
| Ownership mapping | Supported with scope review | 1B/1C owner mapping when properties available |
| Forms / submissions | Supported with scope review | Forms inventory and reconciliation work |
| Engagement / notes | Supported with scope review | Engagement backup + residual coverage |
| Patient protection | Supported | Link-only pilot: 0 patients created; ambiguous quarantine |
| Preview / checksum / rollback boundaries | Supported (internal) | Not exposed publicly as technical detail |
| Full deal/ticket/custom object parity | Not currently included | Not claimed in public scope |
| Automation porting | Not currently included | Redesign vs port |
| Marketing lists / campaign engine | Not currently included | Coexist often retains HubSpot |

Public wording: “Verified migration controls have been tested in controlled operational stages” — no clinic IDs, batch IDs, or production counts on the page.

---

## Demo form integration

- CTA: `/demo?interest=hubspot-migration`
- Maps to form option: **Transition away from HubSpot**
- Also supports: `connect-hubspot` → Connect HubSpot to FI
- Map: `DEMO_INTEREST_QUERY_MAP` in `hubspotMigrationPageContent.ts`

---

## CTA sweep

| Page / source | New label | Destination |
| --- | --- | --- |
| Surgeons | Request a Platform and Migration Review | `/demo` |
| Enterprise | Request a Platform and Migration Review | `/demo` |
| Ecosystem architecture | Request a Platform and Migration Review | `/demo` |
| Intelligence | Explore the Platform | `/platform` |
| Audit network | Explore the Platform | `/platform` |
| Academy | Discuss a Strategic Partnership | `/contact` |
| Solutions | Request a Platform and Migration Review | `/demo` |
| Placeholder marketing | Request a Platform and Migration Review | `/demo` |

---

## Homepage logo addendum status

**Completed in this release (uncommitted work from 1F addendum finished here).**

| Field | Value |
| --- | --- |
| Previous | `favicon-32x32` 30×30 in 48×48 panel; header `min-h-20 py-6` |
| New asset | `public/brand/follicle-intelligence-logo-header-white.png` from `Logo Files/png/White logo - no background.png` (mark crop) |
| Rendered | Mobile `h-6` (24px); Desktop `h-7` (28px); bar `h-14` / `h-16` |
| Shared | `components/layout/header.tsx` site-wide |

---

## Internal links

- Homepage progressive adoption → `/migrate-from-hubspot`
- LeadFlow hero → migration pathway
- Clinic Owners adoption → migration pathway
- Platform Progress tertiary CTA → migration pathway
- Demo/review page → migration pathway
- Footer → HubSpot migration

---

## Screenshots

`docs/marketing/screenshots/fi-web-refresh-1g/`
