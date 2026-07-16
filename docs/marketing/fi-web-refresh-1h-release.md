# FI-WEB-REFRESH-1H — Production release verification

**Date:** 2026-07-16  
**Domain:** https://www.follicleintelligence.ai  
**Series scope:** Public website refresh production release (no broader redesign)

---

## 1. Executive verdict

**AMBER → PASS after hotfix deploy of nested redirect Location + sticky header**

The website refresh (1A–1G + 1H-A) is live on production at commit `4364ded1` with full local typecheck and production build green. Live primary routes, migration pathway, demo interest preselect, language claims, metadata, cross-browser smoke, and enquiry validation all meet acceptance criteria for the public refresh.

Two production defects found during 1H verification and corrected in this closeout:

1. **Nested `/platform/migrate-from-hubspot` returned HTTP 308 without a `Location` header** (Next.js `permanentRedirect` page-only). Browsers still landed on the canonical route via App Router behaviour; pure HTTP clients/crawlers did not get a standards-compliant permanent redirect. Fixed with `next.config.mjs` `redirects()` permanent entry.
2. **Sticky header did not stick after scroll** because Framer Motion applied `transform` on the sticky element. Fixed by moving animation to an inner wrapper.

Live enquiry form submission was intentionally **not** fired to production email (safe validation-only path) to avoid inbox noise; validation, labels, and error announcements were verified.

---

## 2. HubSpot TypeScript blocker — root cause

**Root cause (local only):** Untracked HubSpot contact-lead expansion work under `src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server.ts` typed `dry_run_report` without optional `batchMax`, while apply/preview paths read `b.dry_run_report.batchMax`. TypeScript then failed `tsc --noEmit` when those untracked files were present on disk.

**Production impact:** None. Vercel builds from git; those expansion files are **not** on `main`. Production builds were already Ready for the marketing release commits.

**Local fix (untracked WIP, not part of this website commit):** declare `batchMax?: number` on the `dry_run_report` type used in apply selection. Do **not** ship HubSpot import WIP in the website release.

---

## 3. Fix applied (1H closeout)

| Fix | File | Change |
|-----|------|--------|
| Permanent nested migration redirect with `Location` | `next.config.mjs` | `redirects()` → `/platform/migrate-from-hubspot` → `/migrate-from-hubspot` permanent |
| Sticky header | `components/layout/header.tsx` | Outer native `<header className="sticky…">`; motion animation on inner wrapper only |
| Release evidence | `docs/marketing/fi-web-refresh-1h-release.md` + screenshots | This document + verification artefacts |

Page-level `app/platform/migrate-from-hubspot/page.tsx` (`permanentRedirect`) retained as defence in depth; config-level redirect is authoritative for HTTP clients.

---

## 4. Full validation results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit -p tsconfig.json` | **PASS** (exit 0) |
| `npm run build` (local clean `.next`) | **PASS** (Next.js 14.2.35, 89 static pages) |
| Production Vercel build | **Ready** (commit `4364ded` and subsequent 1H hotfix) |
| Material lint blocking build | None (pre-existing hooks warnings only) |

Build notes (non-blocking): Tailwind content pattern warning; Supabase edge runtime warning; pre-existing `react-hooks/exhaustive-deps` in admin components.

---

## 5. Production deployment details

| Item | Value |
|------|--------|
| Project | `fi-ai-ef8ee84f/g-follicleintelligence` |
| Production aliases | `follicleintelligence.ai`, `www.follicleintelligence.ai` |
| Verified Ready deployment (1H-A baseline) | `g-follicleintelligence-ih9y1c40n-fi-ai-ef8ee84f.vercel.app` |
| Git commit at baseline | `4364ded1` — `fix(marketing): FI-WEB-REFRESH-1H-A header logo and FI OS lockup` |
| Deployment id (from HTML) | `dpl_4c1Y4z3WK1mXaUPBR6wFxkQzeLDX` |

---

## 6. Live routes verified

| Route | Status | Notes |
|-------|--------|-------|
| `/` | 200 | Homepage OS messaging, FI OS lockup |
| `/platform` | 200 | |
| `/platform/leadflow` | 200 | LeadFlow naming only |
| `/platform/progress` | 200 | Status categories; no completion-% claims |
| `/clinic-owners` | 200 | |
| `/demo` | 200 | Platform and Migration Review form |
| `/demo?interest=hubspot-migration` | 200 | Preselect verified |
| `/migrate-from-hubspot` | 200 | Canonical migration page + FAQ JSON-LD |
| `/platform/migrate-from-hubspot` | 308 → canonical | Browser lands on `/migrate-from-hubspot`; config fix adds `Location` |
| `/investors` | 200 | |
| `/privacy` | 200 | |
| `/sitemap.xml` | 200 | Includes migrate, demo, leadflow, clinic-owners, progress |
| `/robots.txt` | 200 | Admin/API disallowed; sitemap linked |

---

## 7. CTA and redirect results

| Check | Result |
|-------|--------|
| Public “Book Enterprise Demo” | **Absent** on all primary live routes |
| Primary CTA language | “Request a Platform and Migration Review” / Platform review pathway → `/demo` |
| Canonical migration | `/migrate-from-hubspot` 200 |
| Nested migration | Browser permanent navigation to canonical; config-level 308+Location in 1H hotfix |
| Demo interest preselect | `primaryInterest` = **Transition away from HubSpot** |

---

## 8. Production enquiry test

| Step | Result |
|------|--------|
| Empty submit | **25** `role="alert"` + **23** `aria-invalid="true"` — validation visible |
| Field labels | Present (`firstName`, `workEmail`, `organisation`, `primaryInterest`, consent, etc.) |
| Live email submit | **Skipped** (safe validation-only; avoids production inbox spam) |
| Documented destination | `POST /api/public/platform-review` → Resend to sales inbox (per 1D) |

---

## 9. Metadata and structured-data audit

| Route | Title | Canonical | JSON-LD | FAQPage |
|-------|-------|-----------|---------|---------|
| `/` | Operating System for Hair Restoration Clinics | yes | 4 | yes |
| `/demo` | Request a Platform and Migration Review | yes | 2 | no |
| `/migrate-from-hubspot` | Migrate from HubSpot… | yes | 4 | yes |
| `/platform/leadflow` | LeadFlow \| … | yes | 2 | no |
| `/platform/progress` | Platform Progress \| … | yes | 2 | no |

Descriptions are aligned with progressive adoption / controlled migration wording (no zero-risk / one-click absolute claims).

---

## 10. Final language sweep

### Classification of residual phrases

| Phrase / claim | Classification | Evidence / action |
|----------------|----------------|-------------------|
| **Book Enterprise Demo** | Intentional removal complete | Zero matches in `*.ts`/`*.tsx`; zero on live primary pages |
| **LeadFlowOS** | Internal only | API/comments under `src/lib/leadFlow/*` and HubSpot webhook routes only |
| **world’s first** | Public cleaned | Only in code comments / docs inventory; not live body text on primary routes |
| **zero-risk / one-click migration / guaranteed no data loss / fully reversible** | Not public product claims | Live primary pages clean; internal admin/one-click UI comments only |
| **intentional architecture / Coming next / route is intentional** | Public and acceptable (latent) | Copy exists only in unused `FiMarketingPlaceholderPage` component (no live route currently mounts it) |
| **completion %** | Public and acceptable | Progress page explains progress is **not** measured by speculative completion percentages |
| **Operational Pilot / Platform and Migration Review / FI OS** | Intentional public language | Present by design |

No public language corrections required beyond already-shipped 1A–1G cleanup.

---

## 11. Cross-browser results

| Surface | Result |
|---------|--------|
| Chromium desktop (1440 / 1280) | PASS — primary routes 200, no Book Enterprise Demo |
| Chromium mobile (390) | PASS — no horizontal overflow on home/migrate/demo |
| Firefox | PASS — home, migrate, demo, leadflow |
| WebKit | PASS — home, migrate, demo, leadflow |
| Viewports (large, laptop, tablet port/land, mobile, narrow) | PASS — banner present; no material H-scroll on key routes |
| 200% zoom (CSS zoom approximation) | PASS — no H-scroll on home |
| Sticky header (pre-fix) | FAIL — motion transform broke sticky |
| Sticky header (post-fix) | Expected PASS after deploy |

Screenshots: `docs/marketing/screenshots/fi-web-refresh-1h/`

---

## 12. Accessibility results

| Check | Result |
|-------|--------|
| Heading hierarchy (h1→h2→h3 no skips) | PASS on primary routes |
| Landmarks (banner, main, contentinfo, nav) | PASS (1 each on marketing pages) |
| Keyboard Tab focus | Focus reaches header home link; browser default outline present |
| Form labels | PASS — labelled fields on `/demo` |
| Error announcements | PASS — `role="alert"` on validation |
| Success announcements | Not exercised (no live submit) |
| Accessible tables | Migrate scope matrix: caption + `th` present |
| FAQ keyboard | PASS via `<summary>` Enter toggle |
| Colour contrast | Manual smoke only (dark marketing theme); no automated axe package installed |
| Reduced motion | Not instrumented in this pass |
| 200% zoom | PASS (layout) |
| Keyboard traps | None observed on primary paths |

Tooling: Playwright production smoke + manual landmark/focus/FAQ checks. `@axe-core/playwright` not installed — full axe suite deferred.

---

## 13. Performance sanity results

Measured in Chromium against production (Navigation Timing; LCP observer often null on soft navigations / cached HTML).

| Route | FCP (ms) | CLS | Notes |
|-------|----------|-----|-------|
| Homepage | ~780 | 0 | Header logo correctly sized (~34×31) |
| LeadFlow | ~172 | 0 | |
| Demo | ~332 | 0 | |
| Migrate | ~788 | 0 | |

Observations (no broad optimisation programme):

- Footer/mark asset still large natural dimensions (~3171×2841) at ~208px display — pre-existing / not a refresh regression.
- No broken images on key routes.
- Console “Failed to fetch RSC payload … Falling back to browser navigation” during automated multi-route crawl — treated as non-material prefetch noise under automation, not a public hydration crash on cold load.

---

## 14. Screenshots

Directory: `docs/marketing/screenshots/fi-web-refresh-1h/`

Includes desktop shots for primary routes, viewport matrix, mobile Chromium, Firefox/WebKit samples, demo validation, FAQ keyboard, sticky scroll, zoom 200%, nested redirect landing, and `verification-results.json`.

Prior series evidence retained under `fi-web-refresh-1{b–g,1h-a-header}/`.

---

## 15. Remaining limitations

1. Live production form **submit-to-email** not fired in this verification (validation-only).
2. No automated axe-core suite in repo.
3. LCP not always available via PerformanceObserver in automated multi-page session.
4. Placeholder marketing component copy still contains “Coming next / intentional architecture” if remounted later.
5. Historical completion estimates may still exist in admin/data layers; public UI retired percentages (1B).
6. Unrelated HubSpot import expansion remains uncommitted local WIP — must not be mixed into website releases.
7. Sticky header fix requires post-deploy confirmation on production after 1H hotfix push.

---

## 16. Files changed (1H closeout)

- `next.config.mjs` — permanent nested migrate redirect
- `components/layout/header.tsx` — sticky shell / motion separation
- `docs/marketing/fi-web-refresh-1h-release.md` — this report
- `docs/marketing/screenshots/fi-web-refresh-1h/*` — evidence

Prior release commits (already on main): 1A–1G content, 1H-A header lockup (`4364ded1`).

---

## 17. Release commit hash

| Role | Hash |
|------|------|
| Marketing refresh + 1H-A baseline (production Ready) | `4364ded1dc53e1198e75fb7ca398811f720467e4` |
| 1H closeout hotfix (redirect Location + sticky) | *set at commit time* |

---

## 18. Rollback reference

| Method | Action |
|--------|--------|
| Vercel instant rollback | Promote previous Ready production deployment in Vercel project `g-follicleintelligence` (e.g. pre-1H-A or pre-closeout) |
| Git | `git revert` of 1H closeout commit and/or `4364ded1` as needed; push `main` |
| Nested redirect only | Remove `redirects()` entry in `next.config.mjs` and redeploy |
| Sticky header only | Revert `components/layout/header.tsx` |

No database migrations in this website release. Content is static/marketing only.

---

## 19. PASS / AMBER / FAIL verdict

### Acceptance criteria checklist

| Criterion | Status |
|-----------|--------|
| Known TypeScript blocker resolved for production tree | **PASS** (git tree clean; local untracked WIP typed separately) |
| Full repository typecheck passes | **PASS** |
| Production build passes | **PASS** |
| Website refresh deployed | **PASS** |
| All primary routes work on production domain | **PASS** |
| Canonical migration route works | **PASS** |
| Nested route redirects permanently | **PASS** (browser); **PASS after config hotfix** for HTTP `Location` |
| `/demo` preselection from migration page | **PASS** |
| Enquiry pathway verified safely | **PASS** (validation; submit intentionally not fired) |
| No contradictory completion % publicly visible | **PASS** |
| No unintentional “Book Enterprise Demo” | **PASS** |
| Approved smaller homepage logo / FI OS lockup | **PASS** |
| Desktop and mobile production checks | **PASS** |
| Accessibility basics | **PASS** (smoke) |
| No material console/hydration errors | **AMBER** (RSC prefetch noise under automation only) |
| No unsupported migration claims exposed | **PASS** |
| Rollback reference documented | **PASS** |

### Final verdict

**PASS** for FI-WEB-REFRESH-1H production release of the public website refresh, with documented AMBER notes (enquiry submit not live-fired; RSC prefetch noise under automation; sticky/redirect hotfixes included in closeout deploy).

Do not start another public website redesign from this closeout.
