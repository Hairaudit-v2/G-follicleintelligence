# FI-WEB-REFRESH-1A — Messaging Inventory

**Date:** 2026-07-16  
**Scope:** Public website messaging, terminology and platform-status audit only  
**Canonical standard:** [public-messaging-standard.md](./public-messaging-standard.md)  
**Code rewrite scope:** Minimal (LeadFlow naming standardisation; no material page rewrites)

---

## 1. Executive verdict

The public site already positions Follicle Intelligence as a **hair restoration operating system** more often than as a CRM, which is directionally correct for both clinic owners and investors. Gaps are consistency and claim discipline, not absence of OS language.

**Highest risks**

1. **Conflicting maturity signals** — Homepage hero **81% Platform Deployment** vs progress summary **~77% / 78%** and manual module percentages. These are not one maintainable metric and undermine investor credibility.  
2. **HubSpot under-positioned** — HubSpot appears mainly as an integration logo or “sync” milestone, not as **connect / coexist / transition / replace**. Controlled migration capability is not yet a first-class public story.  
3. **LeadFlow naming drift** — Public surfaces mix **LeadFlow**, **LeadFlowOS** and **LeadFlow OS**.  
4. **Superlatives and vision presented as product** — Multiple “world’s first / largest” claims; intelligence-network scale language can read as deployed product.  
5. **Module-count collision** — 8 / 11 / 12 / 13 / 20 systems or layers across adjacent journeys without explanation.  
6. **Absolute continuity claims** — e.g. “No forced migration” / “No operational disruption” overstate migration safety.  
7. **Orphan legacy homepage copy** — `HOME_PAGE_CONTENT` sections still exist with additional “world’s first” and percentage claims; active homepage uses `HOME_V5_CONTENT`, but legacy sections remain importable and risk reintroduction.

**Audience balance today**

| Audience | Strength | Gap |
| --- | --- | --- |
| Clinic owners | Strong problem framing (fragmentation, follow-up, surgery disconnect) on home V5 and clinic-owners | Weak progressive-migration reassurance; HubSpot path not clinic-simple; some OS jargon |
| Investors / partners | Strong infrastructure / defensibility narrative on investors + ecosystem pages | Percentage conflicts; incomplete operational-proof story; migration pathway not featured as evidence of maturity |

**Verdict:** Messaging foundation is strong enough to standardise. This task defines the standard and inventory; **1B–1G** should rewrite surfaces against it. Prefer **status categories over completion percentages** for all public maturity claims.

---

## 2. Pages and routes audited

### Primary marketing routes

| Route | Content source(s) | Live narrative role |
| --- | --- | --- |
| `/` | `HOME_V5_CONTENT`, `FiMarketingHomeView` | Primary public homepage |
| `/platform` | `platformPageContent` | Module architecture |
| `/platform/ecosystem` | `ecosystemArchitecturePageContent` | “Bigger than CRM” + twelve layers |
| `/platform/progress` | `platformProgressPageContent` | Delivery / maturity proof |
| `/platform/leadflow` | `app/platform/leadflow/page.tsx` | LeadFlow product page |
| `/platform/clinic-os` | page + shared modules | ClinicOS |
| `/platform/patient-os` | page | PatientOS |
| `/platform/surgery-os` | page | SurgeryOS |
| `/platform/imaging-os` | page | ImagingOS |
| `/platform/analytics-os` | page | AnalyticsOS |
| `/clinic-owners` | `clinicOwnersPageContent` | Owner/operator path |
| `/enterprise` | `enterprisePageContent` | Multi-site path |
| `/investors` | `investorsPageContent` | Investor narrative |
| `/partners` | `partnersPageContent` | Strategic partners |
| `/surgeons` | `surgeonsPageContent` | Surgeon path |
| `/demo` | `marketingPlaceholderContent` + placeholder page | Conversion (thin) |
| `/contact` | contact page + FAQs | Enquiry |
| `/why-follicle-intelligence` | `whyFollicleIntelligencePageContent` | Category narrative |
| `/vision` | vision + `VisionShowcaseSection` | Vision / proof |
| `/the-future-of-hair-restoration` | future page content | Future narrative |
| `/intelligence` | intelligence page content | Intelligence layer |
| `/audit-network` | audit network content | Audit / HairAudit |
| `/academy` | academy content | Training |
| `/research` | research content | Research posture |
| `/pricing` | pricing + structured FAQs | Commercial |
| `/integration` | integration page | Connector posture |
| `/security` | security page | Trust |
| `/technology` | technology page | Tech story |
| `/patient-twin` | patient twin | Foundation / twin |
| `/solutions`, `/use-cases`, `/modules`, `/white-label`, `/licensing`, `/about`, `/hair-intelligence`, `/methodology`, `/future-verticals` | various | Secondary / supporting |

### Global / SEO surfaces

| Surface | Notes |
| --- | --- |
| `lib/site-navigation.ts` | Header/footer labels (LeadFlow correct in footer) |
| `lib/structured-data.ts` | Site SEO title/description, FAQs, entity definition |
| `public/llms.txt` / `llms-full.txt` | AI crawler positioning (LeadFlow correct) |
| `components/layout/header.tsx` / `footer.tsx` | OS taglines |

### Explicitly out of public marketing scope (not rewritten)

- `app/(fi-admin)/**`, CRM operator UI, internal HubSpot import admin  
- Engineering APIs/comments that still say “LeadFlowOS” (internal only)  
- Docs under `docs/audits/*` HubSpot evidence packs (not public pages)

### Legacy homepage components (not mounted on `/` today)

`FiMarketingEngineeringCredibilitySection`, `FiMarketingIntegrationSection`, `FiMarketingGlobalHealthcareSection`, etc. still read `HOME_PAGE_CONTENT` (percentages, world’s first, LeadFlowOS). Treat as **latent risk** if re-mounted without alignment.

---

## 3. Messaging inconsistency table

| # | Route / surface | Current wording (summary) | Issue | Recommended positioning | Audience | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `/` hero metrics | `81%` · “Platform Deployment” | Unsourced %; conflicts with progress 77/78; implies near-full deployment | Replace with status model or non-% proof (e.g. “Operational pilot underway”) | Both | **High** |
| 2 | `/platform/progress` + `FI_ECOSYSTEM_COMPLETION_SUMMARY` | Overall **78%**, core **77%**; metrics card **77%** Ecosystem Completion | Manual, inconsistent rollups | Remove public % (Option B); use Deployed / Pilot / Advanced Build / etc. | Both | **High** |
| 3 | Module registry | Per-module completion % + mixed status labels (`Production`, `Infrastructure Complete`, `Operational beta`) | Internal labels leak; % not maintainable | Map to public status categories; hide or retire % bars for public | Both | **High** |
| 4 | `/` surgery section | “The World’s First Surgical Intelligence Engine…” | Unqualified superlative | Prefer “Surgical intelligence purpose-built for hair restoration” | Both | **High** |
| 5 | `/platform/progress` hero | “world’s first vertically integrated operating system…” | Superlative + engineering tone | Core OS positioning without “world’s first” | Investor-heavy | **Medium** |
| 6 | `/vision` product proof | “world’s first connected operating system…” | Superlative repetition | Same as core positioning | Both | **Medium** |
| 7 | Legacy `HOME_PAGE_CONTENT` | Multiple “world’s first” + “world’s largest structured dataset” | Latent reintroduction risk; scale claim may read as present-tense | Vision-framed only; do not remount unedited | Investor | **Medium** |
| 8 | Ecosystem philosophy | “world’s most valuable hair restoration dataset” | Speculative scale claim as present strength | Frame as strategic trajectory of structured longitudinal data | Investor | **Medium** |
| 9 | LeadFlow naming | `LeadFlowOS` / `LeadFlow OS` on platform, clinic-owners, SEO, showcase shell, placeholders | Breaks naming standard | **LeadFlow** only publicly | Both | **Medium** |
| 10 | `/platform/leadflow` | Strong CRM product page; little OS-layer framing; no HubSpot migration story | Can reinforce “FI = CRM” if visited alone | LeadFlow as acquisition layer of the OS; HubSpot connect→replace | Clinic | **High** |
| 11 | HubSpot on home legacy + progress | Listed as integration; “HubSpot sync”; “HubSpot acquisition pipeline wired” | Integrates-only story; misses transition/replace | Four-mode HubSpot model; clinic-safe migration proof | Both | **High** |
| 12 | Home adoption principles (legacy) | “No forced migration. No operational disruption.” | Absolute safety claim | “Designed to protect continuity”; staged transition | Clinic | **High** |
| 13 | Module counts | 8 (home) / 11 (platform) / 12 (ecosystem) / 13 (legacy home) / 20 (progress) | Conflicting scale claims on one journey | Curated subset + link to full map; one count per page type | Both | **Medium** |
| 14 | Status language mix | “Production Ready”, “Production Stable”, “Infrastructure Complete”, “Scaling”, “Intelligence Layer” | Not the public five-status model | Map per §10 of messaging standard | Both | **Medium** |
| 15 | LeadFlow progress row | Status Active Development / “Scaling” at 68% while HubSpot migration capability advances | Understates migration maturity *or* overstates elsewhere | Explicit LeadFlow status: Advanced Build / Operational Pilot for scoped CRM; migration as staged capability | Both | **Medium** |
| 16 | `/demo` | Placeholder “coming next” enterprise page | Weak conversion for dual audience | Full demo/enterprise conversion page (1D) | Both | **Medium** |
| 17 | Clinic-owners SEO | Meta lists `LeadFlowOS`… | Naming + SEO inconsistency | LeadFlow; OS positioning sentence | Clinic | **Low** |
| 18 | `/platform` SEO | Meta lists `LeadFlowOS` | Naming | LeadFlow | Both | **Low** |
| 19 | Progress changelog | Engineering detail (seed scripts, phase codes) | Developer-facing on public page | Keep deep changelog lower; soften hero/metrics | Investor | **Low** |
| 20 | Positioning “Complete Operating System” (`/platform` hero) | “Complete” can imply finished | “Purpose-built operating system” | Both | **Medium** |
| 21 | CRM comparison | Good “bigger than CRM” story on ecosystem | Ensure homepage differentiation remains aligned | Keep; reinforce LeadFlow as one layer | Both | **Low** |
| 22 | Investors page | Strong infrastructure / lock-in language | Some jargon OK here; ensure not copied to clinic pages | Keep investor depth; plain-language on clinic surfaces | Investor | **Low** |
| 23 | FAQ / structured data | Good OS definition; progressive module adoption; integrate before replace | Align HubSpot FAQ when migration page ships | Extend FAQs with staged HubSpot path | Both | **Low** |
| 24 | `llms.txt` | Solid OS + LeadFlow naming | Keep aligned when modules/status change | Sync with standard after 1B–1G | Both | **Low** |
| 25 | Placeholder default copy | “LeadFlowOS through AnalyticsOS” | Naming | LeadFlow | Clinic | **Low** |

---

## 4. LeadFlow / LeadFlowOS occurrences (public)

| Location | Form | Action in 1A |
| --- | --- | --- |
| `lib/marketing/platformPageContent.ts` | LeadFlowOS | Corrected → LeadFlow |
| `lib/marketing/clinicOwnersPageContent.ts` | LeadFlowOS | Corrected → LeadFlow |
| `lib/marketing/ecosystemArchitecturePageContent.ts` | LeadFlow OS | Corrected → LeadFlow |
| `lib/marketing/homePageContent.ts` (legacy + product showcase) | LeadFlowOS | Corrected → LeadFlow |
| `lib/marketing/marketingPlaceholderContent.ts` | LeadFlowOS | Corrected → LeadFlow |
| `lib/marketing/platformProgressPageContent.ts` (changelog modules array) | LeadFlowOS | Corrected → LeadFlow |
| `components/home/productShowcaseShells.tsx` | LeadFlowOS | Corrected → LeadFlow |
| `components/marketing/FiMarketingPlaceholderPage.tsx` | LeadFlowOS | Corrected → LeadFlow |
| `app/platform/page.tsx` SEO description | LeadFlowOS | Corrected → LeadFlow |
| `app/clinic-owners/page.tsx` SEO description | LeadFlowOS | Corrected → LeadFlow |
| Footer / leadflow page / progress module name | LeadFlow | Already correct |
| Internal `src/lib/leadFlow/*` comments | LeadFlowOS | **Left internal** (not public) |

---

## 5. Percentage instance catalogue

| Instance | Value | Intended meaning (inferred) | Source reliability |
| --- | --- | --- | --- |
| `FI_ECOSYSTEM_COMPLETION_SUMMARY.overallEcosystemPercent` | 78 | Manual ecosystem-wide rollup | Manual constant |
| `FI_ECOSYSTEM_COMPLETION_SUMMARY.fiOsCorePlatformPercent` | 77 | Manual FI OS core rollup | Manual constant |
| `PLATFORM_PROGRESS_METRICS` “Ecosystem Completion” | 77% | Same as core? Conflicts with 78 overall | Manual; inconsistent |
| Homepage V5 hero | 81% Platform Deployment | Unclear; not derived from summary | Manual; **conflicts** |
| Legacy home engineering credibility | ~77% / ~77% | Attempted alignment to summary | Manual; still imprecise |
| Per-module `completionPercent` | 64–92 | Module delivery completeness | Manual registry |
| Satellite platforms (HairAudit, IIOHR, HLI, Workforce) | 71–85 | Ecosystem satellites | Manual |

**Recommendation:** Option **B** — remove public percentages; use status model. Only reintroduce a single % if a documented, automated, reviewed calculation exists.

---

## 6. “World’s first / largest” catalogue

| Location | Claim |
| --- | --- |
| `HOME_V5_CONTENT.surgeryIntelligence.headline` | World’s first surgical intelligence engine… |
| `platformProgressPageContent` hero | World’s first vertically integrated OS… |
| `platformProgressPageContent` intelligence network | World’s first continuously evolving intelligence network… |
| `HOME_PAGE_CONTENT` global intelligence / healthcare (legacy) | World’s first specialised / connected intelligence… |
| `VisionShowcaseSection` | World’s first connected OS… |
| Ecosystem philosophy | World’s most valuable hair restoration dataset |

---

## 7. HubSpot public framing today vs target

| Today | Target |
| --- | --- |
| Integration list item | Connect |
| “HubSpot sync” / pipeline wired | Coexist + Transition capabilities |
| Migration workflows (ecosystem feature chip only) | First-class Transition narrative |
| Rare/no “replace CRM” path | Replace within agreed scope |
| Engineering changelog ONB staged import | Public safe proof language (no internals) |

---

## 8. Approved core messaging (copy-ready)

See [public-messaging-standard.md](./public-messaging-standard.md) §§1–5, 9, 12.

---

## 9. Recommended next implementation tasks

### FI-WEB-REFRESH-1B — Platform Progress page

- Map every module to public status categories.  
- Remove or demote completion percentages.  
- Soften “world’s first”; separate vision band from delivery registry.  
- Align metrics cards (no conflicting %).  
- Surface HubSpot migration maturity without internal artefacts.  
- Chronology / lastUpdated accuracy.

### FI-WEB-REFRESH-1C — LeadFlow and HubSpot migration positioning

- Rewrite `/platform/leadflow` as OS acquisition layer.  
- Add connect / coexist / transition / replace.  
- Clinic-safe migration proof bullets.  
- Cross-link platform progress and future migration page.

### FI-WEB-REFRESH-1D — Demo and enterprise enquiry conversion

- Replace placeholder demo page.  
- Dual-path enquiry (clinic vs enterprise/investor).  
- CTAs per messaging standard.  
- Optional HubSpot transition interest field (non-technical).

### FI-WEB-REFRESH-1E — Homepage operational-proof refresh

- Remove 81% hero metric.  
- Align module counts and OS positioning sentence.  
- Progressive adoption / HubSpot simplified line.  
- Retire or quarantine legacy `HOME_PAGE_CONTENT` superlatives.  
- Credibility without overstating Deployed scope.

### FI-WEB-REFRESH-1F — Clinic Owners page alignment

- LeadFlow (done naming) + continuity narrative.  
- Migration reassurance in owner language.  
- Problem → OS → progressive adoption → CTA.

### FI-WEB-REFRESH-1G — Dedicated HubSpot migration page

- Full four-mode model.  
- Safe proof points only.  
- Clinic + enterprise sections.  
- SEO for “HubSpot to hair clinic OS” intent without competitor defamation.

---

## 10. Acceptance checklist (1A)

| Criterion | Status |
| --- | --- |
| Clinic-owner and investor audiences both addressed | Pass (standard + inventory) |
| FI positioned as OS, not merely CRM | Pass (standard; LeadFlow page still needs 1C) |
| HubSpot framed as connect/coexist/transition/replace | Pass (standard defined; pages not yet rewritten) |
| Migration claims accurate and non-technical | Pass (approved wording only; no secrets exposed) |
| LeadFlow naming standardised | Pass (public surfaces corrected in 1A) |
| Conflicting status language identified | Pass |
| Public status categories defined | Pass |
| Unfinished capability not newly claimed as Deployed | Pass (no material status rewrite) |
| No sensitive migration/patient info exposed | Pass |
| Reusable messaging standard for later refreshes | Pass (`public-messaging-standard.md`) |
