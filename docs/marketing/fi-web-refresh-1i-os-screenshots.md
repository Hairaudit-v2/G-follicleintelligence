# FI-WEB-REFRESH-1I — FI OS product screenshots

**Date:** 2026-07-16  
**Verdict:** AMBER (publishable curated set shipped; clean demo-tenant recapture still deferred)

## Executive verdict

Sixteen source screenshots in `public/os Images/` were audited at full resolution. Six were sanitised, cropped, converted to WebP, and published under `public/os-images/` with canonical `fios-*` names. Weak, empty, administrative, and alarming-metric screens were culled from the public site. Vision’s legacy gallery was replaced with the current FI OS set. Homepage, LeadFlow, Clinic Owners, and Platform received restrained placements.

AMBER (not PASS) because a clean recapture on an approved public demo tenant was not available in this pass — chrome identity was replaced and dense name regions softened, but a first-party demo tenant recapture remains the preferred long-term source.

## Source inventory

| Original filename | Screen | Decision | Reason |
|---|---|---|---|
| `Screenshot_16-7-2026_20454_…` | Today command centre | **Publish after sanitisation** | Strong owner story; chrome + body identity sanitised |
| `Screenshot_16-7-2026_20516_…` | Calendar week view | **Publish after sanitisation** | Strongest visual OS proof; card names softened |
| `Screenshot_16-7-2026_20555_…` | Front Desk Today | **Publish after sanitisation** | Clear flow story; sparse metrics acceptable with demo note |
| `Screenshot_16-7-2026_20539_…` | Patients workspace | **Publish after sanitisation** | PatientOS summary without raw table dump |
| `Screenshot_16-7-2026_201155_…` | Pipeline board | **Publish after sanitisation** | LeadFlow visual story; preferred over list |
| `Screenshot_16-7-2026_201356_…` | Surgery workspace | **Publish after crop + metric reframing** | Empty queues cropped; alarming 200-gap metrics reframed |
| `Screenshot_16-7-2026_201124_…` | Enquiries workspace | **Retain internally** | Mostly zeros + alarming uncontacted totals |
| `Screenshot_16-7-2026_201143_…` | Enquiries list | **Cull** | Dense admin table |
| `Screenshot_16-7-2026_201454_…` | Insights | **Retain / recapture** | Weak REVIEW health scores |
| `Screenshot_16-7-2026_2080_…` | Roster | **Cull** | 72 open roles |
| `Screenshot_16-7-2026_20815_…` | Staff directory | **Cull** | 61 needing attention / 0 clinically eligible |
| `Screenshot_16-7-2026_201256_…` | Quality review | **Cull** | Empty-state dominated |
| `Screenshot_16-7-2026_20833_…` | Onboarding | **Retain internally** | Admin form + empty queue |
| `Screenshot_16-7-2026_20925_…` | Money | **Cull** | AUD 0 revenue / $921k outstanding |
| `Screenshot_16-7-2026_20945_…` | System diagnostics | **Cull** | Operators-only |
| `Screenshot_16-7-2026_201422_…` | Surgery intelligence admin | **Cull** | Admin key field + rebuild controls |

Source originals remain in `public/os Images/` (not deleted).

## Final published set

| Final filename | Placement | Alt text |
|---|---|---|
| `fios-today-command-centre.webp` | Home, Vision, Clinic Owners | Follicle Intelligence Today command centre showing clinic priorities and operational alerts |
| `fios-calendar-week-view.webp` | Home (featured), Vision, Clinic Owners, Platform | FI OS weekly clinic calendar showing scheduled consultations and surgery |
| `fios-front-desk-today.webp` | Home, Vision, Clinic Owners | FI OS Front Desk workspace showing arrivals, blockers and patient actions |
| `fios-patient-journey-workspace.webp` | Vision, Platform | FI OS Patients workspace showing connected patient journey coordination |
| `fios-leadflow-pipeline-board.webp` | Home, Vision, LeadFlow, Platform | LeadFlow pipeline board showing enquiries moving through consultation stages |
| `fios-surgery-workspace.webp` | Home, Vision, Platform | SurgeryOS workspace showing surgical readiness and procedure workflow |

## Privacy audit

| Finding | Action |
|---|---|
| `auditor@hairaudit…` in chrome | Covered by full chrome redraw → `demo@follicleintelligence.ai` |
| `International Hair Restoration Group` | Replaced with `FI Demonstration Clinic` in chrome; body instances masked where located |
| Patient / lead names on calendar & pipeline | Softened via blur plate + band masks |
| Admin key / credentials | Culled (Surgery Intelligence Admin never published) |
| Local `G:\` paths | Never referenced in application code |

## Demo-data audit

- Public note on all showcases: “Interface shown with demonstration data.”
- Surgery metrics reframed to neutral demo figures (24 / 6 / 3 / 4 / 2).
- Insights, Roster, Money, Quality Review deferred pending clean demo tenant.

## Optimisation results

| Asset | Source | Output | Before → After |
|---|---|---|---|
| Today | 3314×1230 | 2200×1120 | ~167KB → ~43KB WebP |
| Calendar | 3314×1230 | 3000×1180 | ~283KB → ~69KB WebP |
| Front Desk | 3314×1230 | 2400×1080 | ~155KB → ~39KB WebP |
| Patients | 3314×1230 | 2400×1040 | ~179KB → ~42KB WebP |
| Pipeline | 3314×1230 | 3000×1140 | ~206KB → ~63KB WebP |
| Surgery | 3314×1230 | 2400×560 | ~200KB → ~28KB WebP |

Preparation script: `scripts/prepare-fios-marketing-screenshots.mjs`

## Website placements

| Route | Treatment |
|---|---|
| `/` | Restrained showcase after progressive adoption — 1 featured + 4 supporting |
| `/vision` | “This Is Not a Concept” — 6 OS story images with strategic captions |
| `/platform/leadflow` | Single featured pipeline board |
| `/clinic-owners` | Today, Front Desk, Calendar |
| `/platform` | Patients, Pipeline, Calendar, Surgery |

## Vision gallery replacement

Legacy JPEGs under `public/marketing/product-showcase/` are no longer referenced by Vision. Retained on disk for historical reference only. No legacy light-mode images remain in the Vision gallery.

## Deferred recaptures

1. Approved public demo tenant with synthetic identities end-to-end  
2. Insights with credible health scores  
3. Populated Quality Review  
4. Neutral Roster / Staff Directory  
5. Enquiries Workspace with balanced conversion metrics  
6. Surgery workspace with populated boards (no empty queues)

## Verification paths

- Asset previews: `docs/marketing/screenshots/fi-web-refresh-1i/preview-*.jpg`
- Website placements (Playwright vs local Next dev `:3002`):
  - `home-{desktop,laptop,tablet,mobile}.png`
  - `vision-{desktop,laptop,tablet,mobile}.png`
  - `leadflow-{desktop,laptop,tablet,mobile}.png`
  - `clinic-owners-{desktop,laptop,tablet,mobile}.png`
  - `platform-{desktop,laptop,tablet,mobile}.png`

## Test / build results

| Check | Result |
|---|---|
| `tests/fiosScreenshots.test.ts` | PASS |
| `tests/homeV5Content.test.ts` | PASS |
| ESLint (changed files) | PASS |
| `tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Responsive placement captures | PASS (dev server) |
| Production `next start` middleware smoke | Pre-existing EvalError in local middleware sandbox (unrelated to this task) |

## Commit

Working tree changes are uncommitted. Parent HEAD at delivery time:

`74638e0eb355ff08a1360dadc14389e3a5bf0fc2`

## Acceptance

| Criterion | Status |
|---|---|
| Every source reviewed | Yes |
| Only strongest published (6) | Yes |
| Weak/admin culled | Yes |
| No admin key published | Yes |
| Canonical names | Yes |
| No timestamp public refs | Yes |
| Homepage showcase | Yes |
| LeadFlow + Clinic Owners imagery | Yes |
| Vision legacy replaced | Yes |
| Clean demo tenant recapture | Deferred → **AMBER** |
