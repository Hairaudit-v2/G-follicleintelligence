# FI-WEB-REFRESH-1B — Platform Progress page refresh

**Date:** 2026-07-16  
**Depends on:** FI-WEB-REFRESH-1A (`docs/marketing/public-messaging-standard.md`)  
**Route:** `/platform/progress`

---

## 1. Before → after structure

| Before | After |
| --- | --- |
| Engineering-heavy hero + “world’s first” | Current platform position + OS transition framing |
| Completion % metrics strip (77% ecosystem) | Status count summary (Deployed / Pilot / Advanced / …) |
| Architecture stack + 20-system groups with % bars | Grouped by **public status**: Operational → Advanced Build → In Development → Research |
| Full module registry with % and internal phase labels | Status badges + milestone + description (no public %) |
| Separate VIE / Event Bus deep engineering sections | Folded into status registry + verified milestones |
| Deployment timeline with internal codes (GC-11, SA-2, …) | Public-safe verified milestones + HubSpot migration feature |
| Intelligence network manifesto as competitive moat | Strategic direction (vision, not deployed product) |
| Defensibility / founder conviction engineering tone | Adoption pathway + conversion CTAs |
| Single CTA style toward engineering progress | Explore platform · Discuss transition · HubSpot pathway |

---

## 2. Status assigned to each module

| Module | Public status | Evidence basis (internal) |
| --- | --- | --- |
| FoundationOS | **Deployed** | Patient Twin identity spine; cross-module substrate in production codepaths |
| Security Layer | **Deployed** | Tenant isolation, RLS, field-level permissions |
| Event Bus | **Deployed** | Event architecture released; subscriber/retry/idempotency in use |
| ClinicOS | **Operational Pilot** | Scheduling, clinic shell, multi-site calendar; Evolved operational pilot |
| PatientOS | **Operational Pilot** | Longitudinal records + twin integration in pilot operations |
| LeadFlow | **Operational Pilot** | Native CRM/pipeline, ownership, follow-up; HubSpot connect/transition; staged import; e2e pipeline |
| ImagingOS | **Operational Pilot** | Protocol capture, AI execution framework, surgery imaging linkage |
| VIE | **Operational Pilot** | VIE-1…7 completed in tracker; audit packs still pending |
| AuditOS | **Operational Pilot** | HairAudit exposure + surgery linkage in pilot scope |
| WorkforceOS | **Operational Pilot** | Roster, readiness, HR sync, planning intelligence |
| OnboardingOS | **Operational Pilot** | Staged HubSpot import, provisioning, deployment tooling |
| CalendarOS | **Operational Pilot** | Google Calendar connector + settings centre in pilot |
| Integration Layer | **Operational Pilot** | Connector auth/verification; HubSpot/Calendar pathways |
| ConsultationOS | **Advanced Build** | Templates, pathway launcher, quotes — readiness expanding |
| SurgeryOS | **Advanced Build** | Procedure-day + imaging summary; broader day-of still expanding |
| HairIntel | **Advanced Build** | Classification/interpretation pipelines — not full AI product claim |
| AnalyticsOS | **Advanced Build** | Event publishing expanded; executive depth maturing |
| AcademyOS | **Advanced Build** | Competency curriculum spine |
| AI Intelligence Layer | **Advanced Build** | Deterministic pipelines first; learning systems expanding |
| FinancialOS | **In Development** | Ledger/clearance foundations; not operational product claim |
| Global Intelligence Network | **Research and Future Development** | Strategic vision only |

---

## 3. Removed or softened claims

| Removed / softened | Replacement |
| --- | --- |
| Ecosystem completion 77% / 78% / 81% on progress surfaces | Status category counts |
| Per-module completion % bars (public) | Status badges + milestones |
| “World’s first vertically integrated OS” | OS transition framing without superlative |
| “World’s first continuously evolving intelligence network” as present product | Strategic direction — vision, not operational |
| “Infrastructure delivery registry” engineering tone | Operational systems / advanced build sections |
| Internal milestone codes (GC-11, SA-2, ONB-F5, VIE-6, IHRG-DEMO-1, AN-C) | Public-safe titles |
| LeadFlow “HubSpot acquisition pipeline wired” only | Native pipeline + controlled HubSpot transition |
| “Production Ready / Production Stable / Infrastructure Complete” badges | Deployed / Operational Pilot / Advanced Build / … |
| Absolute “fully deployed globally” language | Scoped Deployed / Operational Pilot definitions |
| “Infinite” continuous learning metric | Removed from public metrics |

Historical % constants retained in `FI_ECOSYSTEM_COMPLETION_SUMMARY` and optional `completionPercent` for **admin/internal** only (`retiredFromPublicUi: 2026-07-16`).

---

## 4. HubSpot migration public wording (safe)

Featured milestone uses approved 1A language: backup, preview, identity reconciliation, duplicate prevention, post-migration verification; connect / coexist / transition / replace.

No batch IDs, checksums, table names, tenant IDs, cohort identities, or patient data.

---

## 5. CTAs

| CTA | Target |
| --- | --- |
| Explore the Platform | `/platform` |
| Discuss Your Clinic’s Transition | `/contact` |
| View the HubSpot Migration Pathway | `/platform/leadflow` (until dedicated 1G page) |

---

## 6. Updated date

`PLATFORM_PROGRESS_PAGE_CONTENT.hero.lastUpdated = 2026-07-16`
