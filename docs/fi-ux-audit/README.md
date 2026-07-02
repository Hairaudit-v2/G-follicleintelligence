# FI-UX-AUDIT-1 — FI OS Ground-Truth Map

**Audit date:** 2026-07-02  
**Method:** Code-only inventory — routes from `app/`, labels from presentation/nav config files. No assumptions.

## Deliverables

| # | Document | Purpose |
|---|----------|---------|
| 1 | [01-route-inventory.md](./01-route-inventory.md) | Every deployed FI OS route, gate, and alias |
| 2 | [02-ui-terminology-dictionary.md](./02-ui-terminology-dictionary.md) | Canonical button/nav labels + deprecated variants |
| 3 | [03-workflow-maps.md](./03-workflow-maps.md) | Click-path workflows (reception, calendar, surgery, CRM) |
| 4 | [04-role-journeys.md](./04-role-journeys.md) | First-time user journeys by role/persona |
| 5 | [05-operator-guide.md](./05-operator-guide.md) | **Canonical operator guide** — replaces scattered UAT scripts |
| 6 | [06-live-browser-validation.md](./06-live-browser-validation.md) | Playwright pass on demo tenant (2026-07-02) |
| — | [CONCEPTUAL_DOCS_DEPRECATED.md](./CONCEPTUAL_DOCS_DEPRECATED.md) | Retired vision/design docs (archived) |

## Single sources of truth (code)

| Concern | File |
|---------|------|
| Sidebar nav labels + hrefs | `src/lib/fiAdmin/fiOsShellPrimaryNav.ts` |
| Quick Create palette | `src/lib/fiAdmin/fiOsQuickCreateItems.ts` |
| Reception flow action labels | `src/lib/fiOs/receptionBoardFlowPolicy.ts` |
| Reception lane labels | `src/lib/fiAdmin/receptionBoardPresentation.ts` |
| In-app screen guides | `src/lib/fiOs/staffUatScreenGuide.ts` |
| Workspace personas | `src/config/fiWorkspaceProfiles.ts` |
| Feature → route gates | `src/config/fiRouteFeatureMap.ts` |
| Platform roles | `src/lib/fiOs/fiOsRoles.ts` |
| Tenant admin roles | `src/lib/tenantAdmin/tenantAdminRoles.ts` |

## Canonical URL patterns

- **Login:** `/follicle-intelligence/login`
- **Tenant home:** `/fi-admin/{tenantId}`
- **Reception board (sidebar target):** `/fi-admin/{tenantId}/reception` — patient flow dashboard
- **Command center (legacy route):** `/fi-admin/{tenantId}/reception-board` — different UI ("Clinic operations cockpit")
- **Calendar:** `/fi-admin/{tenantId}/calendar`
- **Procedure day:** `/fi-admin/{tenantId}/procedure-day`
- **Settings:** `/fi-admin/{tenantId}/configuration`

## How to verify a guide claim

1. Find the route in [01-route-inventory.md](./01-route-inventory.md).
2. Find the label in [02-ui-terminology-dictionary.md](./02-ui-terminology-dictionary.md) and confirm the source file.
3. Walk the workflow in [03-workflow-maps.md](./03-workflow-maps.md) as a first-time user.

## Operator doc canon (keep)

- `docs/fi-ux-audit/05-operator-guide.md` — primary staff guide
- `docs/fi-os-real-clinic-uat-checklist.md` — checklist (align routes to audit)
- `docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md` — env/setup
- `docs/runbooks/reception-os-production-readiness.md` — production runbook
- In-app: `StaffUatScreenGuide` component (UAT mode)

## Retired

Conceptual design and platform-vision docs moved to `docs/_archive/conceptual/`. See [CONCEPTUAL_DOCS_DEPRECATED.md](./CONCEPTUAL_DOCS_DEPRECATED.md).