# FI-UX-AUDIT-1 — Live Browser Validation

**Date:** 2026-07-02  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a` (Evolved Hair Restoration Perth)  
**Host:** `http://localhost:3000` (`next dev`, `FI_ENABLE_DEV_ADMIN_ACCESS=true`)  
**Tool:** Playwright + accessibility snapshot (`e2e/fi-ux-audit-labels.spec.ts`)

## Summary

| Surface | Status | Notes |
|---------|--------|-------|
| Reception board `/reception` | ✅ Pass | H1 "Reception Board", CTAs, snapshot cards, flow board |
| Legacy `/reception-board` | ✅ Pass (different UI) | H1 **Clinic operations cockpit** — command center, not `/reception` |
| Sidebar nav | ✅ Pass | Labels match `fiOsShellPrimaryNav.ts` |
| Top bar search + Quick create | ✅ Pass | Exact placeholder and button names |
| Quick create button | ✅ Pass | "Open quick create" / "Quick create" visible |
| Quick create palette items | ⚠️ Code-only | Palette open flaky in Playwright on `next dev`; labels verified in `fiOsQuickCreateItems.ts` |
| Operations centre | ✅ Pass | Loads with Open Calendar CTA |
| Calendar view toggles | ⏭ Skipped | Calendar nav **disabled** in dev without bookings role |

## Verified labels (on screen)

### Reception board page

| Element | Live text | Dictionary | Match |
|---------|-----------|------------|-------|
| Page H1 | Reception Board | Reception Board (page title) | ✅ |
| CTA | Open Calendar | Open Calendar | ✅ |
| CTA | Open Operations Centre | Open Operations Centre | ✅ |
| CTA | Open Procedure Day | Open Procedure Day | ✅ |
| CTA | Open FinancialOS | Open FinancialOS | ✅ |
| CTA | Quick Create Booking | Quick Create Booking | ✅ |
| Section | Reception snapshot | — | ✅ |
| Snapshot card | Expected arrivals | Expected arrivals | ✅ |
| Snapshot card | Checked in | Checked in | ✅ |
| Snapshot card | Waiting | Waiting | ✅ |
| Snapshot card | In consultation / treatment | In consultation / treatment | ✅ |
| Flow section | Patient flow board | — | ✅ |
| Flow lane (populated) | Waiting | Waiting | ✅ |
| Flow lane (populated) | Completed | Completed | ✅ |
| Card link | Open booking | Open booking | ✅ |
| Card link | Open patient | Open patient | ✅ |

### Sidebar (`navigation: FI OS modules`)

| Label | Match |
|-------|-------|
| Dashboard | ✅ |
| Operations centre | ✅ |
| Reception board | ✅ |
| Tomorrow board | ✅ |
| Cases / Case worklist / SurgeryOS / Readiness board | ✅ |
| Pathology / Results inbox / Email routes | ✅ |
| Patient Twin | ✅ |
| Audit intelligence | ✅ |
| FinancialOS | ✅ |
| Analytics | ✅ |
| ReceptionOS | ✅ (under **Intelligence** group) |
| SurgeryOS | ✅ (duplicate under Intelligence + Cases sub-nav) |
| Staff | ✅ |
| Settings | ✅ (disabled without config role) |

### Top bar

| Element | Live text | Match |
|---------|-----------|-------|
| Search button | Open workspace search | ✅ |
| Search placeholder | Search patients, leads, cases… | ✅ |
| Quick create | Open quick create / Quick create | ✅ |

## Route split (critical)

| Route | H1 | Component |
|-------|-----|-----------|
| `/reception` | Reception Board | `ReceptionBoardDashboard` |
| `/reception-board` | Clinic operations cockpit | `ReceptionBoardCommandCenter` |

Sidebar **Reception board** links to `/reception`. Guides and e2e must not treat `/reception-board` as an alias.

## Drift found (update dictionary / guides)

| Issue | Canonical (policy) | Live UI | Action |
|-------|-------------------|---------|--------|
| Flow action button | Check in **patient** (`receptionBoardFlowPolicy.ts`) | Chip: **Check in** | Document both; guides should say full label, note chip short form |
| Flow lanes | 6 lane labels always listed | Only **non-empty** lanes render | Guides: lanes appear when patients are in that stage |
| ReceptionOS nav placement | Grouped with reception in mental model | Sidebar **Intelligence** section | Update workflow maps / operator guide |
| Calendar in dev | Nav link | **Disabled** (no bookings operator in dev session) | UAT needs authenticated demo credentials for calendar pass |
| Mutation mode | Flow actions visible | Dev unauthenticated: banner "Sign in with clinic access…" | Expected; use `FI_E2E_DEMO_ADMIN_*` for action-button validation |
| Open Operations Centre | Title case Centre | Matches live | ✅ |

## Automated re-run

```bash
# Terminal 1
pnpm dev

# Terminal 2
FI_E2E_BASE_URL=http://localhost:3000 \
FI_E2E_TENANT_ID=c2615b95-b707-4485-aa5f-be8f78ec868a \
FI_E2E_BROWSERS=chromium \
npx playwright test e2e/fi-ux-audit-labels.spec.ts
```

For calendar + authenticated flow actions, add:

```bash
FI_E2E_DEMO_ADMIN_EMAIL=... FI_E2E_DEMO_ADMIN_PASSWORD=... \
npx playwright test e2e/fi-ux-audit-labels.spec.ts e2e/calendar-os-v2-clinic-day.spec.ts
```

## Screenshot

Failed-test artifact captured full shell: `test-results/fi-ux-audit-labels-*/test-failed-1.png` (initial run before spec fix).