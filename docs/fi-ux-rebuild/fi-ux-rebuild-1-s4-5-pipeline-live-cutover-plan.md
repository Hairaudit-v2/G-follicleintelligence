# FI-UX-REBUILD-1 — S4.5: Pipeline Live Cutover, Navigation Consolidation & Legacy Redirects

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Depends on:** S4.1 (`527aff21`), S4.2 (`e693b680`), S4.3 (`90e959bb`) landed; **S4.4 in flight** (shell/full loaders, permission resolver, batch enrichment, identity guard, dual-run, harness — do not touch).
**Scope:** Route switch, navigation consolidation, legacy redirects, release safety. **No** DB migration, CRM engine rebuild, or mutation rewrite.

> **Cutover thesis.** `PipelineWorkspace` is complete and self-sufficient (own state, refresh, mutations wired). The `/crm` **layout already provides** the access gate (`getCrmShellPageSession` + `assertStaffModuleAccess(tenantId, "lead_flow", "read")`), `CalendarToastProvider`, and `CrmLeadSlideOverProvider`. S4.5 therefore only: (a) swaps the `/crm` **page** body to render `PipelineWorkspace` from the S4.4 loaders, (b) normalises legacy `?view=` queries, (c) collapses three nav entries into one **Pipeline** door, (d) redirects `/leadflow` + `/consultation-conversion`. Lead deep-links already use `/crm/leads/{id}` (Today, search) — nothing to repoint.

---

## 1. Current live route inventory

| Route | Component | Loader | Access gate | Mutations | Nav visibility | S4.5 outcome |
|---|---|---|---|---|---|---|
| `/crm` (default `?view=workspace`) | `LeadFlowDashboard` | `loadLeadFlowDashboardPayload` | layout: CRM shell + `lead_flow:read` | via lead detail/kanban | "Follow-ups" row → `/crm` | **Canonical → PipelineWorkspace** |
| `/crm?view=board` | `CrmKanbanBoard` | `loadCrmShellLeadsBoardIndex` | same | `crmMoveLeadStageAction` | — | Board view |
| `/crm?view=list` | `CrmLeadListTable` | `loadCrmShellLeadsIndex` | same | — | — | Board (query normalise) |
| `/crm/leads/[leadId]` | lead workspace | `loadCrmShellLeadDetailPagePayload` | same | tasks/comms/stage/convert | search/Today deep-links | **Unchanged (lead drill-in)** |
| `/leadflow` | `LeadFlowOperatorDashboard` | `loadLeadFlowOperatorDashboardPayload` | CRM shell | — | "Enquiries" row → `/leadflow` | **Legacy → redirect `/crm`** |
| `/consultation-conversion` | `ConsultationConversionBoard` | `loadConsultationConversionBoardPayload` | `assertFiTenantPortalAccess` (portal) | — | Consultations sub-item | **Legacy → redirect `/crm`** |
| Today lead links | — | `todayFeedDerive` → `/crm/leads/{id}` | — | — | Today feed | **Unchanged** |
| Global search lead links | `ClinicOsGlobalSearch` → `/crm/leads/{id}` | — | — | — | search | **Unchanged** |
| Quick-create | `NewEnquiryDialog` (`createLead`) | — | CRM shell | create | on `/crm` | **Reused in Pipeline header** |
| Platform-admin CRM diagnostics | (S4.4 harness/preview, if built) | S4.4 | platform-admin | — | none | Platform-admin only |

**Route classes:** canonical = `/crm`; lead-detail = `/crm/leads/[leadId]`; legacy staff = `/leadflow`, `/consultation-conversion`; platform-admin diagnostic = S4.4 preview (if any); hidden internal = none additional.

---

## 2. Exact target route behaviour

```
/fi-admin/{tenantId}/crm
    → PipelineWorkspace   (Board default; Follow-ups via in-page view state)
/fi-admin/{tenantId}/crm/leads/{leadId}
    → existing lead workspace (unchanged)
```

**Staff label = "Pipeline"; route slug stays `/crm`** — reusing the slug preserves every bookmark and the already-canonical `/crm/leads/{id}` deep-links (no operational reason to rename; renaming would break all lead links).

| Old URL | S4.5 behaviour |
|---|---|
| `/crm?view=workspace` | Normalise → Board (default) |
| `/crm?view=board` | Board |
| `/crm?view=list` | Board + preserve compatible filters (dense table not reproduced; temporary fallback note) |
| `/crm?view=follow_ups` | Follow-ups view |
| `/crm?view=<unknown>` | Board (fail safe) |
| old `owner`/`stage`/`source`/`q` filters | Preserved into the Pipeline lead window (§11) |
| bookmarked list pages (`page`/`pageSize`) | Pagination window preserved (loader-owned) |
| lead slide-over deep links | Preserved (layout provides `CrmLeadSlideOverProvider`) |
| direct `/crm/leads/{id}` | Unchanged |

Prefer **query normalisation inside `/crm`** (temporary compatibility helper) over breaking old URLs.

---

## 3. `/crm` page switch design

**Remove from `/crm/page.tsx`:**

| Remove | |
|---|---|
| `?view=` selector branching (workspace/board/list) | `LeadFlowDashboard`, `CrmKanbanBoard`, `CrmLeadListTable`, `CrmLeadIndexViewTabs`, `CrmLeadListFilters/Pagination` |
| `loadLeadFlowDashboardPayload`, `loadCrmShellLeadsIndex`, `loadCrmShellLeadsBoardIndex` (direct), `loadCrmShellScopePickerOptions` (as page-owned) | manager analytics widgets; separate Follow-ups framing; raw-stage derivation |

**Add:**

```tsx
// /crm/page.tsx (target shape)
const shell = await loadPipelineShellPayload(tenantId, searchParams);   // S4.4
async function onRefreshPresentation() { "use server"; return (await loadPipelineFullPayload(tenantId, searchParams)).presentation; }
return (
  <PipelineWorkspace
    tenantId={tenantId}
    initialPresentation={shell.presentation}
    tenantStages={shell.tenantStages}
    permissions={shell.permissions}
    currentUserId={shell.currentUserId}
    canCreateEnquiry={shell.permissions.canMutate}
    onRefreshPresentation={onRefreshPresentation}
  />
);
```

**Remains (mostly via the layout — unchanged):** CRM-shell gate (`getCrmShellPageSession` + `assertStaffModuleAccess(…, "lead_flow", "read")`), `CrmLeadSlideOverProvider`, `CalendarToastProvider`, `NewEnquiryDialog`, all existing mutations, `/crm/leads/[leadId]`, platform-admin proxy (inside the gate), read-only handling (S4.2 emits nav-only actions). Keep `metadata.title = "Pipeline"`, `dynamic = "force-dynamic"`, `notFound()`/`InfoNotice` error handling.

The page must **not** render any legacy CRM view alongside Pipeline.

---

## 4. Shell/full hydration cutover

```
Server: loadPipelineShellPayload → render PipelineWorkspace immediately (loadTier: "shell")
Client: adapter calls onRefreshPresentation() once after mount → loadPipelineFullPayload
        → S4.4 shell/full identity guard → swap to full only if lead-ID sets match
```

- **When full begins:** after first paint (the adapter's `fullPresentation`/`onRefreshPresentation` path). Shell paints instantly on SSR.
- **Identity mismatch:** S4.4 `assertPipelineTierIdentity` blocks the swap — keep shell visible, log a platform-admin diagnostic; never replace with a divergent set.
- **Refresh failure:** the adapter already catches and keeps the last valid presentation (`refreshError` note, no blank).
- **Actions during shell:** `move_stage`, `assign_owner`, `open_lead`, `convert`, `mark_lost`, New enquiry work on shell fields; `complete_follow_up`/`schedule_follow_up`/consultation-dependent actions wait for full (S4.3 disables until enriched).
- **Card count fixed** across shell→full; **stage positions may only change** on an explicit refresh (which re-runs both stages consistently), never from enrichment alone.
- **Races:** single `isRefreshing` guard in the adapter; **stale full responses rejected** by the identity guard + last-writer-wins on `generatedAt`.
- **No second polling loop; no full-screen spinner after shell.**

---

## 5. Dual-run cutover sequence

| Phase | Commit | Content | Rollback |
|---|---|---|---|
| **1 — Route switch only** | S4.5A | `/crm` → Pipeline; `/leadflow`, `/consultation-conversion`, legacy `?view=`, duplicate nav all **still live** | revert one page file |
| **2 — Controlled live dual-run** | S4.5B | run S4.4 comparison on a selected tenant/window; mutation matrix; parity | no code (verification) |
| **3 — Navigation consolidation** | S4.5D | rename slot to Pipeline; remove duplicate Enquiries/Follow-ups/Conversion entries | revert nav registry |
| **4 — Legacy redirects** | S4.5E | redirect `/leadflow`, `/consultation-conversion` → `/crm` (307) | revert legacy pages |
| **5 — E2E & role closure** | S4.5F | tablet, access, query compat, mutation E2E | — |

(Query compatibility S4.5C slots between A and D.) **Never combine the route switch (A) with redirects (E).** Each phase is independently revertible.

---

## 6. Live dual-run sign-off

Attach from S4.4's `PipelineDualRunComparison` (IDs/counts only, no PHI): tenantId; search/filter window; source lead total; shell visible lead IDs; full visible lead IDs; legacy lead IDs; missing/extra/duplicate; stage comparison; owner comparison; overdue comparison; conversion/lost comparison; consultation comparison; hidden/truncated count; enumerated intentional differences; `pass`.

**Synthetic fixtures alone are insufficient for cutover.** Preferred gate: **fixtures prove behaviour** + **one staging or controlled live tenant proves real loader parity** + the §7 workflow walkthrough. **If only synthetic verification is available, keep the switch feature-gated (Option B, §16) until a real-tenant run passes** — do not arm redirects on synthetic parity.

---

## 7. Legacy workflow parity walkthrough

Lead-ID parity is necessary but not sufficient. Every workflow must be present in Pipeline or the lead workspace before redirects arm.

| Workflow | Current location | Pipeline location | Mutation reused | Status |
|---|---|---|---|---|
| Create enquiry | `/crm` dialog | Pipeline header `NewEnquiryDialog` | `createLead` | ✅ direct |
| Review new enquiry | board/list | Board "New" column | — | ✅ direct |
| Assign owner | lead detail | card → lead workspace | owner update | ✅ workspace |
| Contact lead | lead detail | card `contact` → workspace | comms | ✅ workspace |
| Log outcome | lead detail | workspace | comms outcome | ✅ workspace |
| Schedule follow-up | lead detail | workspace / follow-ups | task create | ✅ workspace |
| Complete follow-up | lead detail / task queue | Pipeline Follow-ups + card | `completeCrmTaskAction` | ✅ direct |
| Reschedule follow-up | lead detail | workspace | task update | ✅ workspace |
| Move stage | kanban drag/menu | card **Move stage** (staff column → real stage) | `crmMoveLeadStageAction` | ✅ direct |
| Book consultation | lead detail / calendar | card → workspace | booking | ✅ workspace |
| Mark lost | kanban menu | card **Mark lost** (reason) | `crmMoveLeadStageAction` → lost | ✅ direct |
| Reopen | lead detail | card `reopen` → workspace | stage move | ✅ workspace |
| Convert | lead detail | card **Convert** → workspace conversion | `executeCrmLeadConversion` | ✅ workspace |
| Open patient | converted link | card `open_patient` | — | ✅ direct |
| View full comms history | lead detail | lead workspace | — | ✅ workspace |
| Search leads | `/crm` search | Pipeline server search | — | ✅ (verify) |
| Filter owner/stage/source | `/crm` filters | Pipeline filters | — | ✅ (verify) |

**Classification:** all items are *available directly in Pipeline* or *through the lead workspace*; **intentionally removed** = manager analytics, HubSpot operator intelligence, dense list columns, conversion-board framing. **True blockers to verify before arming redirects:** (1) any **bulk** action on the old list/board (e.g. multi-select owner assign) — confirm it exists or is intentionally dropped; (2) the **conversion board's** specific consult→surgery triage view — confirm the Pipeline `consultation` state + Booked/deposit column + workspace cover it; (3) **search/filter fidelity** parity. No redirect is armed while any true blocker remains.

---

## 8. Navigation consolidation audit

| Current entry | Route | Staff label | Target action |
|---|---|---|---|
| `crm` row | `/leadflow` | "Enquiries" | **Rename → "Pipeline"; point href → `/crm`** |
| ↳ sub `leadflow-dashboard` | `/leadflow` | "Enquiries" | **Remove** (redirect covers URL) |
| ↳ sub `crm-workspace` | `/crm` | "Enquiries" | **Remove** (Pipeline is the row itself) |
| `follow-up-queue` row | `/crm` | "Follow-ups" | **Remove** (Follow-ups is a Pipeline view) |
| `consultations` ↳ `consultation-conversion-board` | `/consultation-conversion` | "Conversion board" | **Remove** from staff nav |
| Active-route map: `/leadflow` → `crm` | — | — | Map `/crm`, `/leadflow`, `/consultation-conversion` → Pipeline group |
| Quick-create menu | — | "New enquiry" | Keep (Pipeline header) |
| Today links / search | `/crm/leads/*` | — | Unchanged |

**Target: one visible Pipeline door.** No separate staff entries for Enquiries, CRM, Follow-ups, LeadFlow, or Conversion board. Board/Follow-ups are **in-page views**, not peer nav. **Reuse the existing `crm`/Enquiries slot** (rename) — do not add a rail item.

---

## 9. Proposed Pipeline navigation contract

```
Pipeline            (single nav item; href /crm)
├── Board           (in-page view state — default)
└── Follow-ups      (in-page view state)
```

**Preferred minimal contract:** one Pipeline nav item; Board/Follow-ups controlled **inside the page** (the adapter's `PipelineViewTabs`); **no duplicate sidebar sub-items** (the current CRM row has none functionally needed once consolidated).

- **Active state `/crm`:** Pipeline row active.
- **Active state `/crm?view=follow_ups`:** Pipeline row active (view is in-page; nav doesn't split).
- **Active state `/crm/leads/[leadId]`:** Pipeline row active (drill-in).
- **After legacy redirects:** `/leadflow`, `/consultation-conversion` land on `/crm` → Pipeline active.
- **Mobile/More:** single Pipeline entry.
- **A11y label:** "Pipeline".

---

## 10. Legacy route redirect plan

Local **server-page `redirect()`** (`next/navigation`) — no middleware.

| Route | Target | Type | Query mapping | Preserve query | Telemetry |
|---|---|---|---|---|---|
| `/leadflow` | `/crm` | 307 (S4.5) → 308 (S11) | none (plain Pipeline) | safe `owner`/`q` only | `legacy_route_hit{leadflow}` |
| `/consultation-conversion` | `/crm` | 307 → 308 | **none** — do not fake a filter | drop unsafe params | `legacy_route_hit{conversion}` |

- **`/consultation-conversion` → plain `/crm`.** The consult→surgery board is not representable as one safe Pipeline filter (it spans consultation state + stages + bookings); redirect to `/crm` and preserve the workflow via card `consultation` state, the Booked/deposit column, and the lead workspace. **Do not invent a misleading `?view=board&lifecycle=active` mapping.**
- **`/leadflow` → `/crm`** (Board default). Optionally forward a safe `owner`/`q` if present.

**Old `?view=` handling — query normalisation inside `/crm`** (not redirects, since same route): `workspace→Board`, `board→Board`, `list→Board`(+compatible filters), `follow_ups→Follow-ups`, `unknown→Board`. A small **temporary compatibility helper** maps the legacy `view` param to the adapter's initial view; remove in S11.

Redirects preserve only **safe** query params with a real target contract; unknown/unsafe params dropped; no patient-identifying data in URLs.

---

## 11. Query compatibility

| Legacy param | New Pipeline equivalent | Preserve | Translate | Drop |
|---|---|---|---|---|
| `view` | in-page view (Board/Follow-ups) | — | ✅ normalise | old `workspace`/`list` value |
| `owner` | server owner filter | ✅ | — | — |
| `stage` | server backend-stage filter | ✅ | maps to staff column client-side | — |
| `status` | lifecycle (active/holding/terminal) | — | ✅ | if unsupported value |
| `source` | server source filter | ✅ | — | — |
| `q` / `search` | server search (affects window + total) | ✅ | — | — |
| `page` / `pageSize` | loader window | ✅ | — | — |
| sorting | S4.2 deterministic sort | — | — | ✅ (drop custom sort) |
| conversion-board filters | — | — | — | ✅ (no target) |

- **Server-side (affect canonical lead window + total):** `owner`, `stage`, `source`, `q`, pagination — passed to `loadPipelineShellPayload`/`loadPipelineFullPayload` `searchParams`.
- **Client-side (re-slice loaded cards):** staff column, urgency, lifecycle, view.
- **Do not silently drop `search`/`owner`** used by bookmarked staff workflows. **Unknown values fail safe to default.** No patient-identifying data preserved in URLs beyond existing contracts.

---

## 12. Route and navigation terminology

**Use (staff-facing):** Pipeline, Board, Follow-ups, New enquiry, Move stage, Contacting, Consultation, Planning / quote, Booked / deposit, Converted, Nurture, Closed / lost.

**Remove from staff chrome:** CRM, LeadFlow, Kanban, CRM workspace, CRM list, Conversion board, Lead operator, OS/cockpit/command-centre wording.

**Update:** metadata titles (`/crm` → "Pipeline"; legacy pages' titles moot after redirect), breadcrumbs, nav labels, screen-guide names, accessible labels, empty states, shell hints, staff UAT docs. **Internal file/function names may stay** (`crmShellAccess`, `LeadFlow*` loaders) — renaming adds risk without staff benefit.

---

## 13. Role and permission regression matrix

| Role / session | View | Create | Assign | Contact | Follow-up | Move stage | Mark lost | Convert | Book consult |
|---|---|---|---|---|---|---|---|---|---|
| CRM operator | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Consultant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (clinic) | ✅ |
| Receptionist (full CRM) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| Receptionist (capability override) | ✅ | ➖ per `canUseClinicFeatures` | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| Clinic manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tenant admin (CRM-allowed) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform admin | ✅ (proxy) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Finance | ➖ (only if CRM-shell) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Nurse | ➖ (view if shell/override) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Surgeon | ➖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Read-only | ➖ view | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |

✅ yes · ➖ conditional (capability override / CRM-shell / clinic features) · ✖ no. Preserve CRM-shell access, `canUseClinicFeatures` overrides, distinct booking + conversion capabilities, platform-admin proxy, and server re-checks. **No Pipeline role.** Verify a receptionist with an approved override retains access **without** becoming a CRM operator/admin (the override rides `canUseClinicFeatures`, resolved by `resolvePipelinePermissions`).

---

## 14. Mutation verification

| Action | UI entry | Existing mutation | Refresh path | Expected result |
|---|---|---|---|---|
| Create enquiry | header dialog | `createLead` | `onRefreshPresentation` | new lead in New |
| Move stage | card Move-stage menu | `crmMoveLeadStageAction` (real stage id) | one refresh | card in new column |
| Complete follow-up | card / Follow-ups | `completeCrmTaskAction` | one refresh | task done, counts update |
| Schedule/reschedule follow-up | workspace | task create/update | refresh | task appears |
| Owner assignment | workspace | owner update | refresh | owner changes |
| Communication outcome | workspace | comms | refresh | logged |
| Consultation booking | workspace/calendar | booking | refresh | consultation state |
| Mark lost (reason) | card confirm | `crmMoveLeadStageAction` → lost | refresh | Closed/lost + reason metadata |
| Reopen | workspace | stage move → active | refresh | back to active |
| Convert | card → workspace | `executeCrmLeadConversion` | refresh | patient link |

Requirements (already enforced by S4.3 adapter): **no staff-column id reaches a stage mutation** (resolver returns real id; rejects `stageId === columnId`); **no optimistic move**; server-confirmed refresh via **one owner**; failed mutation preserves prior card state; focus returns; live announcement; read-only cannot call; capability override honoured. **Mutation E2E on a staging tenant / dedicated test lead** — never random production leads.

---

## 15. Lead-detail and deep-link protection

`/crm/leads/[leadId]` stays unchanged (do not redirect lead-detail). Verify: direct lead URL loads; Today deep-links (`todayFeedDerive` → `/crm/leads/{id}`) resolve; global search (`/crm/leads/{id}`) resolves; notifications/follow-up/calendar/converted-patient links resolve; browser back works; slide-over deep links work (layout provides the provider); copied URLs work. Tests:
- Direct `/crm/leads/{id}` still works.
- Closing the slide-over returns to the current Pipeline view + filters (adapter state, URL-backed).
- `/leadflow` / `/consultation-conversion` redirect to `/crm` **without losing lead context** (they were never lead-scoped).
- Patient links remain correct.
- **Search/Today links do not point at retired `/leadflow`** (already `/crm/leads/*` — confirmed) — regression-guard it.

---

## 16. Feature flag and rollback strategy

**Recommendation: Option A (no flag, reversible commit) — *conditional* on a passing S4.4 real-tenant dual-run.** The switch is a single page-file change with legacy routes untouched, so rollback = revert one file. If S4.4 sign-off is **synthetic-only**, use **Option B (tenant allowlist flag)** to enable Pipeline for one controlled tenant first, then remove the flag once a real-tenant run passes.

If Option B: owner = a simple server-resolved tenant allowlist (env or `fi_tenant_settings`); **default off**; tenant-scoped; removed at S4.5 completion (S11 at latest); **no permanent dual UI**. Avoid Option C (per-user opt-in) — adds a preference framework the product lacks.

**Minimum rollback (all options):** revert `/crm/page.tsx`; legacy routes stay live and untouched until sign-off; **no database rollback** required.

---

## 17. Tablet and browser verification

E2E at 768×1024, 1024×768, phone, desktop. Verify: vertical stage stack on tablet; **no nested horizontal scroll**; no page-level overflow; sticky controls don't eat excessive height; Board/Follow-ups switch; filters; New enquiry dialog fits; Move-stage menu usable; follow-up completion usable; lead slide-over fits; terminal/holding sections collapse; ≥44px touch targets; **no drag requirement**. Cover supported desktop browsers + the clinic tablet browser where known (extend `e2e/` — Pipeline already ships tablet/a11y tests from S4.3).

---

## 18. Accessibility sign-off

Semantic stage sections; accessible counts; keyboard Move-stage (drag alternative); accessible overflow menus; keyboard filters; focus restoration after mutations; polite mutation announcements (`PipelineLiveRegion`); non-colour urgency cues; destructive confirmations (mark-lost/convert dialogs); read-only notice; collapsed-section semantics (`aria-expanded`); no duplicate page headings; **no hidden legacy tabs in the a11y tree**; no technical CRM/LeadFlow language. Static checks + **one Playwright keyboard path** (open `/crm` → tab to a card → Move stage via keyboard → assert live announcement).

---

## 19. Performance and refresh verification

Using S4.4 timing data, verify: shell first paint fast; full hydration within budget; **no N+1** (batch loaders only); no duplicate lead query beyond the intended shell+full pattern; **one refresh after mutation**; **no default poller**; no repeated hydration per render; stale response cannot overwrite newer state (identity guard + `generatedAt`); full failure keeps shell/last-full; hidden/truncated counts accurate.

Cutover thresholds: **block on N+1 or a refresh loop** regardless of environment; do not block on absolute local timings if prod infra differs — surface timings as platform-admin structured logs (counts + elapsed + tenantId, no PHI).

---

## 20. Telemetry during cutover

Temporary, no PHI (no names/emails/phones/notes/content): Pipeline route load success/failure; shell/full identity mismatch; dual-run mismatch type; hidden/truncated lead count; unknown-stage count; orphan-task count; mutation failure by action; refresh failure; **legacy route hit** (`/leadflow`, `/consultation-conversion`); **legacy query-view use** (`view=list`/`workspace`); Board vs Follow-ups use. Feeds **S11** retirement of legacy routes + compatibility helpers (retire when legacy hits drain to ~0).

---

## 21. S4.5 go/no-go gates

**Data (green):** no missing/extra leads; no duplicate cards; shell/full IDs identical; stages reconcile; owners reconcile; converted/lost reconcile; overdue reconcile; consultation links reconcile/documented; hidden counts accurate.
**Workflow (green):** create, move stage, complete follow-up, assign owner, book consultation, mark lost/reopen, convert, lead workspace, search + deep links all work.
**Access (green):** capability overrides work; read-only non-mutating; platform-admin proxy works; booking/convert capabilities distinct.
**UX (green):** one Pipeline door; Board + Follow-ups only; old labels gone; tablet + keyboard pass; diagnostics hidden; one refresh owner; no N+1; build green.

**Block:** any lead disappears/duplicates; shell/full windows diverge; staff-column id reaches a mutation; task assignee replaces owner; comms hint overrides task; legacy lead deep links break; read-only gains mutation; capability override lost; full hydration blanks the board; duplicate nav entries remain; CRM/LeadFlow terms remain in staff chrome; redirect loops; ordinary staff see diagnostics.

**Sign-off checklist:** dual-run `pass=true` on a real/staging tenant · workflow-parity table all ✅/documented · mutation matrix green · role matrix verified · tablet/keyboard E2E green · nav shows one Pipeline door · legacy URLs resolve · build + nav-drift + preflight green.

---

## 22. Suggested implementation sequence

- **S4.5A — Reversible `/crm` route switch:** mount `PipelineWorkspace` via S4.4 loaders; legacy routes + nav unchanged; no redirects.
- **S4.5B — Live dual-run & workflow sign-off:** controlled tenant result; mutation matrix; shell/full parity; performance.
- **S4.5C — Query compatibility:** normalise old `view`; preserve `owner`/`stage`/`source`/`q`; remove List/Workspace visual tabs.
- **S4.5D — Navigation consolidation:** rename Enquiries/CRM slot → Pipeline; remove duplicate Enquiries + Follow-ups + Conversion-board entries; update active-route maps + terminology.
- **S4.5E — Legacy redirects:** `/leadflow` → `/crm`; `/consultation-conversion` → `/crm`; confirmed follow-up alias → Follow-ups view; temporary/reversible.
- **S4.5F — E2E, role & docs closure:** tablet; keyboard; access; deep links; terminology; nav audits; UAT guides; completion report.

**Do not combine S4.5A and S4.5E.**

---

## 23. File-level plan

| Commit | Edit | Add | Tests / audits |
|---|---|---|---|
| S4.5A | `app/(fi-admin)/fi-admin/[tenantId]/crm/page.tsx` (body → PipelineWorkspace) | — | page render test (Pipeline present, legacy absent) |
| S4.5C | `crm/page.tsx` (query normalise) + a small `src/lib/crm/pipelineQueryCompat.ts` (pure) | `pipelineQueryCompat.ts` + test | query-map unit tests |
| S4.5D | `src/lib/fiAdmin/fiOsShellPrimaryNav.ts` (rename `crm` row → Pipeline, href `/crm`; remove sub-items + `follow-up-queue` + `consultation-conversion-board`; active-route map) | — | nav consolidation test; nav-drift/go-live audits; role preflight; terminology audit |
| S4.5E | `app/.../leadflow/page.tsx`, `app/.../consultation-conversion/page.tsx` → thin `redirect()` | — | redirect tests (no loop); legacy-hit telemetry |
| S4.5F | screen guides / UAT docs; `docs/fi-ux-rebuild/*` | `e2e/pipeline-*.spec.ts` (tablet/keyboard/deep-link) | terminology + nav audits green |

**Do not modify:** S4.1–S4.4 files (S4.4 in flight), CRM mutations, HubSpot ingestion, DB, Front Desk files, `/crm/leads/[leadId]`. **No unnecessary internal CRM file renames.** Nav registry (`fiOsShellPrimaryNav.ts`) is the main non-page edit — coordinate; it is not a Front Desk or S4.4 file.

---

## 24. Acceptance test plan

1. `/crm` renders Pipeline. 2. Legacy workspace/board/list components absent. 3. Shell renders first. 4. Full hydration preserves lead IDs. 5. Identity mismatch doesn't replace shell. 6. Board is the deterministic default. 7. Follow-ups view works. 8. `view=board`→Board. 9. `view=workspace`→safe (Board). 10. `view=list`→Board/temp fallback. 11. Owner filter preserved. 12. Stage filter preserved. 13. Search preserved. 14. One Pipeline nav item. 15. Duplicate Enquiries nav removed. 16. Follow-ups peer nav removed. 17. Conversion-board staff nav removed. 18. `/leadflow`→Pipeline. 19. `/consultation-conversion`→Pipeline. 20. No redirect loops. 21. Lead-detail deep links live. 22. Today lead links live. 23. Search lead links live. 24. Read-only no mutations. 25. Capability override has expected mutations. 26. Move stage uses real backend id. 27. Complete follow-up uses existing task mutation. 28. New enquiry uses existing create flow. 29. Conversion uses existing flow. 30. Failed mutation preserves server state. 31. One refresh owner. 32. No default polling. 33. Tablet no nested horizontal scroll. 34. Keyboard stage move works. 35. Touch targets ≥44px. 36. Diagnostics hidden from staff. 37. No CRM/LeadFlow/Kanban/OS terms in staff chrome. 38. Nav drift audit passes. 39. Role preflight passes. 40. Production build passes.

---

## Conclusion

**1. Exact live `/crm` route contract** — `/crm` → `PipelineWorkspace` (Board default, Follow-ups in-page); `/crm/leads/[leadId]` unchanged. Slug stays `/crm` (no rename). Layout continues to supply the CRM-shell gate, `lead_flow:read` entitlement, `CalendarToastProvider`, and `CrmLeadSlideOverProvider`.

**2. Exact shell/full hydration sequence** — SSR `loadPipelineShellPayload` → render immediately → client calls the single `onRefreshPresentation` (`loadPipelineFullPayload`) → S4.4 identity guard → swap only if lead-ID sets match; card count fixed; positions change only on explicit refresh; one loop; no post-shell spinner; stale/mismatch rejected.

**3. Query compatibility table** — §11: `view` normalised (workspace/board/list/unknown→Board, follow_ups→Follow-ups); `owner`/`stage`/`source`/`q`/pagination preserved (server window); sorting + conversion-board filters dropped; unknown fails safe to Board; no PHI in URLs.

**4. Final navigation contract** — one **Pipeline** door (rename the existing Enquiries/`crm` slot, href `/crm`); Board/Follow-ups are in-page views; remove duplicate Enquiries sub-items, the Follow-ups row, and the Conversion-board sub-item; active state = Pipeline for `/crm`, `/crm?view=follow_ups`, `/crm/leads/*`, and post-redirect legacy routes; no new rail item.

**5. Legacy redirect table** — `/leadflow` → `/crm` and `/consultation-conversion` → `/crm`, local server-page `redirect()`, **307 in S4.5 → 308 in S11**, safe query only, no misleading filter mapping, no middleware, no loops.

**6. Role and capability matrix** — §13; preserve CRM-shell access, `canUseClinicFeatures` overrides, distinct booking/convert capabilities, platform-admin proxy, server re-checks; receptionist override keeps access without role inflation; **no Pipeline role**.

**7. Dual-run & workflow sign-off** — attach S4.4 `PipelineDualRunComparison` (IDs/counts, no PHI) **plus** the §7 workflow-parity walkthrough; fixtures alone insufficient — require one real/staging-tenant run; keep feature-gated until that passes; no redirect armed while any true workflow blocker remains.

**8. Feature-flag/rollback** — **Option A (no flag, reversible one-file switch)** if S4.4 real-tenant dual-run passes; else **Option B (tenant allowlist, default off)** until it does. Rollback = revert `/crm/page.tsx`; legacy routes stay live; no DB rollback.

**9. S4.5 go/no-go gates** — §21: data + workflow + access + UX greens; block on any vanished/duplicated lead, divergent windows, staff-column id in a mutation, assignee-as-owner, hint-over-task, broken deep link, read-only mutation, lost override, blanked board, residual duplicate nav, residual CRM/LeadFlow terms, redirect loop, or staff-visible diagnostics.

**10. Highest-risk cutover issue** — **workflow-parity gaps masked by lead-ID reconciliation.** Because both dual-run sides derive from the same board index, IDs reconcile trivially — creating false confidence while a workflow reachable *only* from the legacy list/workspace/conversion board (bulk owner assign, the consult→surgery triage view, a specific saved filter or dense-table sort) silently has no Pipeline/​workspace home. If a redirect is armed on ID parity alone, staff lose that workflow with no path back. Resolution: the §7 walkthrough is a **hard gate** — every workflow must be ✅ direct / ✅ workspace / explicitly documented-removed before S4.5E arms any redirect; redirects are the **last** phase, after the route switch has run live and been observed. Secondary risk: the bare-`/crm` default changing from the old `workspace` dashboard to Board — mitigated by query normalisation and telemetry on `view=` usage.

**11. Minimum reversible S4.5 slice** — **S4.5A alone**: swap `/crm/page.tsx` to render `PipelineWorkspace` from the S4.4 shell/full loaders, leaving `/leadflow`, `/consultation-conversion`, every legacy `?view=`, and all duplicate nav entries **live and unchanged**. Pipeline becomes the live `/crm` experience with zero navigation or redirect changes, fully reversible by reverting one file — and it lets the S4.4 dual-run and the §7 workflow walkthrough run against the real route before the query-compat, nav-shrink, and redirect phases land.
