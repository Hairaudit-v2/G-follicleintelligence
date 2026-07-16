# FI-WEB-REFRESH-1F — Clinic Owners page alignment

**Date:** 2026-07-16  
**Route:** `/clinic-owners`  
**Depends on:** 1A messaging standard, 1B–1E public narrative

---

## Before → after

| Before | After |
| --- | --- |
| “Build And Scale A High-Performance…” | “Run the clinic as one connected operation.” |
| Book Enterprise Demo | Request a Platform and Migration Review → `/demo` |
| “Six modules · one operational spine” | Owner outcomes + grouped systems (no fixed count) |
| Module spine diagram (6 bands) | Growth / operations / clinical / procedure / intelligence groups |
| Dashboard card grid only | Visibility with Operational Pilot / Expanding / Future |
| No progressive adoption | Connect · Coexist · Transition · Replace |
| No migration continuity | Controlled transition safeguards |
| Limited multi-site | Multi-site standardisation section |
| Weak compound value | Longitudinal history value without investor jargon |

---

## Claims classification (summary)

| Area | Classification |
| --- | --- |
| Lead ownership, pipeline, follow-up | Operational Pilot |
| Connected patient journey spine | Operational Pilot (depth varies by module) |
| Clinic day coordination / calendar | Operational Pilot |
| Workforce readiness | Operational Pilot |
| Surgery measurability | Expanding / Advanced Build elsewhere |
| Owner commercial visibility | Operational Pilot |
| Clinical/outcomes dashboards | Expanding |
| Full financial/strategic intelligence | Future |
| Multi-site support | Designed for / progressive — not “already global” |
| Instant full replacement | Unsupported — removed |

---

## CTA decisions

| CTA | Destination |
| --- | --- |
| Primary | `/demo` — Request a Platform and Migration Review |
| Secondary (hero) | `/platform` |
| Tertiary | `/platform/progress` |
| Closing secondary | `/platform/progress` |
| Closing tertiary | `/platform/leadflow` |

---

## Remaining site-wide “Book Enterprise Demo”

Still present on some non-home marketing pages (surgeons, enterprise, intelligence, audit-network). Deferred to post-1G CTA sweep.

---

## Deferred to 1G

- Dedicated HubSpot migration page
- Deeper object-level migration detail
- Full remaining CTA cleanup across all marketing pages

---

## Addendum — Homepage header logo sizing

### Previous logo asset

| Field | Value |
| --- | --- |
| Asset | `/icons/favicon-32x32.png` via `PUBLIC_IMAGES.favicon32` |
| Rendered | 30×30 CSS px inside a 48×48 (`h-12 w-12`) panel |
| Header chrome | `min-h-20` + `py-6` (oversized vertical rhythm) |

### Selected replacement

| Field | Value |
| --- | --- |
| Source | `Logo Files/png/White logo - no background.png` |
| Reason | Correct FI brand mark on dark UI; transparent background; white mark for header contrast; crop to chevron mark for compact nav (full stack logo is too tall for the bar) |
| Repo path | `/public/brand/follicle-intelligence-logo-header-white.png` |
| Source dimensions | 131×96 px (cropped + resized from 3172×2842 master) |
| Runtime | Served from repo via Next `Image` + `PUBLIC_IMAGES.follicleLogoHeaderWhite` |

### New rendered dimensions

| Viewport | Image CSS | Header bar |
| --- | --- | --- |
| Mobile | `h-6` (24px) auto width | `h-14` (56px) |
| Desktop (`sm+`) | `h-7` (28px) auto width | `h-16` (64px) |
| Intrinsic width/height attrs | 36×26 | Prevents CLS |

Aspect ratio preserved (`w-auto`). No stretch/crop in CSS.

### Shared header impact

`components/layout/header.tsx` is shared across public marketing pages (sticky header). Change applies site-wide to that component only.

**Not changed:** footer wordmark (`follicleLogoWhite` SVG), Open Graph / favicon metadata assets.

### Screenshots

`docs/marketing/screenshots/fi-web-refresh-1f-logo/`

- `desktop-header.png`
- `desktop-header-narrow.png`
- `mobile-header.png`
- `desktop-header-scrolled.png` (sticky state)
