# FI-UX-REBUILD-1 — S4.5E: Legacy Route Redirect Plan

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Prereqs met:** S4.5D nav consolidation complete (one Pipeline door; `/crm` canonical; `/crm/leads/[leadId]` unchanged; both legacy routes still live/non-redirecting). Real staging dual-run + shell/full identity passed; no hard data mismatch; no legacy-only workflow blocker. Outstanding: one S4.5D terminology fix in the legacy `/crm` fallback; a live staff-credential mutation walkthrough.
**Scope:** Redirect `/leadflow` and `/consultation-conversion` → `/crm`. No other route, nav, loader, or mutation change.

> **Key discovery.** Both legacy loaders take **only `tenantId`** — `loadLeadFlowOperatorDashboardPayload(tenantId)` and `loadConsultationConversionBoardPayload(tenantId)` parse **no query params**. So there is **nothing to preserve**: redirecting to plain `/crm` is provably lossless, and forwarding query params would only risk stale/unsafe state. The one real subtlety is an **access-gate difference** — `/leadflow` uses CRM-shell, `/consultation-conversion` uses broader **portal** access — which the redirect narrows fail-safely.

---

## 1. Route ownership audit

| Route | Current loader | Access gate | Query params | Unique workflows | Direct inbound links | Redirect target |
|---|---|---|---|---|---|---|
| `/leadflow` | `loadLeadFlowOperatorDashboardPayload(tenantId)` | `getCrmShellPageSession` (CRM-shell) | **none parsed** | HubSpot-first operator intelligence (read-only dashboard) | none in nav (S4.5D repointed all to `/crm`); analytics module *names* only | `/crm` |
| `/consultation-conversion` | `loadConsultationConversionBoardPayload(tenantId)` | `assertFiTenantPortalAccess` (**portal**, broader) | **none parsed** | Consult→surgery conversion board (read view) | `LeadFlowDashboard` (legacy), `consultationPresentation.ts`, `leadFlowPresentation.ts`, `ConsultationOsDashboard` (updated S4.5D) | `/crm` |

- **No nested routes, no local layouts** — both inherit the tenant `(fi-admin)` layout (not the `/crm` layout).
- Both are **PIN-restricted** (`PIN_RESTRICTED_ROUTE_PREFIXES` includes `/leadflow`… actually `/consultation-conversion` and `/crm`; `/leadflow` is CRM-shell-gated and not staff-PIN reachable regardless).
- Metadata: `/leadflow` title "Enquiries" (moot post-redirect); `/consultation-conversion` title "Consultation conversion" (moot post-redirect).

---

## 2. `/leadflow` redirect contract

**Safe → redirect to plain `/crm`.** The loader ignores all query params, so `owner`/`q`/`search`/`source`/`stage` were **never functional** on `/leadflow` — dropping them is lossless. Access is **equivalent** (both `/leadflow` and `/crm` use `getCrmShellPageSession` / CRM-shell).

- **Target:** `/fi-admin/{tenantId}/crm` (plain).
- **Do not** append `?view=board` — Board is already the deterministic default in `PipelineWorkspace`; adding it invents redundant view state.
- **Whitelist:** none required (drop all) — see §6.

## 3. `/consultation-conversion` redirect contract

**Redirect to plain `/crm`.** The old board is a read-only consult→surgery funnel view; it parses no query params, so plain `/crm` loses no filter state. **Do not** synthesize a filter (e.g. `?view=board&lifecycle=active`) to imitate the old board — there is no precise Pipeline query contract for it, and a fake mapping would mislead.

**Old workflow remains available through:**
- **Pipeline consultation state** — each lead card carries `consultation.state` (`booked`/`due_today`/`completed`/`no_show`/`cancelled`).
- **Booked / deposit column** — post-consult conversion progress lives in the `booked_deposit` staff column.
- **Lead workspace** — full consultation history, quotes, and conversion on `/crm/leads/{id}`.
- **Consultation booking** — existing booking flow (unchanged).
- **Conversion workflow** — `executeCrmLeadConversion` via the lead workspace.

**No unique operational *action*** existed only on the old board — it was a **read/triage** surface, not a mutation surface (its loader is read-only; conversions always happened in the lead workspace). → **No `redirect_blocker`.**

---

## 4. Access and permission preservation

| Aspect | `/leadflow` | `/consultation-conversion` | `/crm` (target) |
|---|---|---|---|
| Gate | CRM-shell (`getCrmShellPageSession`) | **Portal** (`assertFiTenantPortalAccess`) | CRM-shell + `lead_flow:read` (layout) |
| `lead_flow:read` | via layout | not required today | required |
| Platform-admin proxy | yes | yes (portal) | yes (proxy inside gate) |
| Capability override | via `canUseClinicFeatures` | portal-level | via `canUseClinicFeatures` |
| Staff-PIN | restricted | **restricted** | **restricted** |
| Unauthorised | → `/cases` (gate) | portal-denied | → `/cases` (gate) |

**Findings:**
- **`/leadflow` → `/crm`: access-equivalent** (same CRM-shell gate). No regression, no expansion.
- **`/consultation-conversion` → `/crm`: gate narrows portal → CRM-shell.** A user with **portal access but no CRM-shell access** currently sees the conversion board but would be **bounced to `/cases`** by the `/crm` gate. This is a deliberate, **fail-safe narrowing** — the conversion board is retiring into Pipeline (a CRM-shell surface), and the target gates independently so **no access is expanded and nothing leaks**. Document it; it is not a regression of a *needed* workflow (read-only triage now covered inside CRM-shell Pipeline).
- **Staff-PIN unchanged:** both `/consultation-conversion` and `/crm` are in `PIN_RESTRICTED_ROUTE_PREFIXES` — PIN sessions are blocked before and after the redirect. **No PIN change.**
- **Fail-safe behaviour:** the redirect pages should **not** re-implement access checks — a bare `redirect("/crm")` lets the `/crm` gate authorise. This leaks nothing (the target gates) and avoids double-gating that could confuse or loop. (Duplicating the gate is only warranted if the redirect itself could expose data — it cannot, since it renders nothing.)

---

## 5. Redirect mechanism

**Local server-page `redirect()` from `next/navigation`** in each legacy `page.tsx`. **No middleware** (unnecessary for two local routes; middleware adds a global matcher and obscures tenant scoping).

- **Temporary during S4.5E** — use Next's default redirect (307-equivalent) so the step is reversible if telemetry or the mutation walkthrough surfaces an issue.
- **Permanent (308) only in S11** — after retirement evidence (legacy hits drained to ~0).

**Exact file edits** (replace the entire page body):

```tsx
// app/(fi-admin)/fi-admin/[tenantId]/leadflow/page.tsx
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function LeadFlowLegacyRedirect({
  params,
}: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  redirect(`/fi-admin/${tenantId.trim()}/crm`);
}
```
```tsx
// app/(fi-admin)/fi-admin/[tenantId]/consultation-conversion/page.tsx  — identical shape
```
Remove the metadata/loader/component imports from each (the page renders nothing). **Do not delete** `LeadFlowOperatorDashboard`, `ConsultationConversionBoard`, or their loaders — they stay in source until S11.

---

## 6. Query whitelist

| Legacy route | Parameter | Preserve | Translate | Drop | Reason |
|---|---|---|---|---|---|
| `/leadflow` | `owner` | | | ✅ | Loader never parsed it; not functional on this route |
| `/leadflow` | `q` / `search` | | | ✅ | Same — no query contract on `/leadflow` |
| `/leadflow` | `source` | | | ✅ | Same |
| `/leadflow` | `stage` | | | ✅ | Same |
| `/leadflow` | any other | | | ✅ | Unknown → drop |
| `/consultation-conversion` | (any) | | | ✅ | Loader takes only `tenantId`; no filters to carry; old board filters have no Pipeline equivalent |

**Drop all, both routes.** Requirements satisfied: only supported filters preserved (none exist), unknown values dropped, **no PII forwarded**, no stale legacy view state carried, no query-derived loop risk, tenant ID preserved (it is the path param, not a query). **No whitelist helper is justified** — plain `redirect(\`/fi-admin/${tenantId}/crm\`)` suffices, so `pipelineLegacyRedirects.ts` is **not needed**.

---

## 7. Redirect-loop audit

**Claim:** `/leadflow → /crm`, `/consultation-conversion → /crm`, and `/crm` never redirects back.

- **`/crm` page** (`crm/page.tsx`): renders `PipelineWorkspace` (allowlisted) or the legacy `CrmShellPage` body (non-allowlisted). It contains **no `redirect()` to `/leadflow` or `/consultation-conversion`**.
- **`/crm` gate** (`getCrmShellPageSession`, via layout): only ever redirects unauthorised users to `/fi-admin/{tid}/cases` or `/fi-admin` — **never** to a legacy pipeline route. `/cases` does not redirect back to `/leadflow`/`/consultation-conversion`. → No cycle.
- **Active-route helpers** (`getFiOsShellActiveSidebarId`, `getClinicOsShellActiveNavId`) map `/leadflow` and `/consultation-conversion` to nav id `crm` — **navigation highlighting only, not HTTP redirects**. No loop.
- **`pipelineQueryCompat.ts`** (existing) normalises `?view=` values *inside* `/crm`; it does not redirect to legacy routes.

**Tenant coverage:**
- **Allowlisted tenant:** `/leadflow` → `/crm` → `PipelineWorkspace` renders. ✅
- **Non-allowlisted tenant:** `/leadflow` → `/crm` → legacy `CrmShellPage` renders (Pipeline not enabled) — lands safely, no loop. ✅
- **Unauthorised:** `/leadflow` → `/crm` → gate → `/cases`. Terminates. ✅

**Loop-free proven** for both routes, both tenant states, authorised and unauthorised.

---

## 8. Inbound link audit

| Link source | Route | Classification | Action |
|---|---|---|---|
| Primary nav / More / rail / quick-create | `/leadflow` | already repointed to `/crm` in S4.5D | none |
| `NewEnquiryDialog` import path (`components/fi-admin/leadflow/…`) | — | component path, **not** a route link | none |
| analytics module names (`"leadflow"` moduleId) | — | analytics identifier, not a URL | none |
| `fiRouteFeatureMap` (`leadflow` → `crm` feature) | — | feature mapping, resilient | none |
| `LeadFlowDashboard.tsx:53,304` → `/consultation-conversion` | legacy `/crm` fallback body | **safe to leave** (redirect handles); retiring with the fallback | leave (or fix in S4.5D terminology pass) |
| `consultationPresentation.ts` (5 hrefs) → `/consultation-conversion` | active consultation dashboards | **update now** (active surface) or leave for telemetry | recommend proactive update |
| `leadFlowPresentation.ts` (2 hrefs) → `/consultation-conversion` | legacy leadflow presentation | safe to leave (redirect handles); retiring | leave |
| `ConsultationOsDashboard.tsx` | `/consultation-conversion` | **already updated → `/crm`** in S4.5D | done |
| `staffPinPermissions.ts` | `/consultation-conversion` | **access block-list entry, not a link** — keep (still valid to block the old URL) | keep |
| `docs/fi-ux-audit/*`, `docs/live-data-input-audit.md`, `docs/fi-ux-rebuild/*` | both | documentation only | update route inventory notes (non-blocking) |

**Recommendation:** the redirect makes every inbound link *functional* (they resolve to `/crm`), so none is a blocker. **Proactively update the active-surface hrefs** in `consultationPresentation.ts` (they feed live consultation dashboards) to point at `/crm`; **leave** links inside the retiring legacy `/crm` fallback and `leadFlowPresentation.ts` to be removed with those components in S11, using `legacy_route_hit` telemetry to confirm they've drained. No lead-detail (`/crm/leads/{id}`), Today, or global-search link points at either legacy route (all already `/crm/leads/{id}`).

---

## 9. Workflow parity gate

| Workflow | Classification |
|---|---|
| Create enquiry | `preserved_directly` (Pipeline header `NewEnquiryDialog` → `/crm`) |
| Search | `preserved_directly` (Pipeline server search) |
| Owner filter | `preserved_directly` |
| Stage filter | `preserved_directly` |
| Complete follow-up | `preserved_directly` (Follow-ups view / card) |
| Contact / log outcome | `preserved_in_lead_workspace` |
| Book consultation | `preserved_in_lead_workspace` |
| Convert | `preserved_in_lead_workspace` (`executeCrmLeadConversion`) |
| Mark lost / reopen | `preserved_directly` (card) / `preserved_in_lead_workspace` |
| Consultation triage | `preserved_directly` (card `consultation` state + `booked_deposit` column) + `preserved_in_lead_workspace` |
| Full lead detail | `preserved_in_lead_workspace` (`/crm/leads/{id}`) |

**No workflow is available only on `/leadflow` or `/consultation-conversion`** — both are read/triage surfaces whose data and actions are covered by Pipeline + the lead workspace. **Zero `redirect_blocker`.** Gate: **PASS**.

---

## 10. Operator mutation gate

The staging **dual-run passed**, but a **live staff-credential mutation walkthrough** (move stage, complete follow-up, mark lost, reopen, create enquiry, convert, book consultation on a staging test lead) is **still outstanding**. Redirects funnel every legacy-URL and bookmark user into Pipeline's mutation surface, so activating them before that surface is human-verified would expose unverified mutations to real staff.

**Recommendation:**
```
PROCEED WITH REDIRECTS HELD
```
Land and test the redirect code (S4.5E) so it is review-ready and reversible, **but do not merge/activate the redirects until the live mutation walkthrough passes on staging.** The redirect edits themselves touch no mutations and are independently revertible — hold *activation*, not authoring. (Also hold until the S4.5D "Conversion board view" terminology fix lands, so non-allowlisted users redirected into the legacy `/crm` fallback don't meet a prohibited term.)

---

## 11. Telemetry

PHI-safe, before and after activation:
- `legacy_route_hit{route: leadflow|consultation-conversion}` — count.
- `legacy_redirect{route, outcome: success|failure}`.
- `legacy_redirect_forwarded_keys` — **key names only** (expected empty; drop-all).
- `legacy_redirect_target_denied` — count of redirects whose `/crm` gate bounced the user to `/cases` (surfaces the portal→CRM-shell narrowing for `/consultation-conversion`).
- `legacy_bookmark_usage` — hits with an external referrer.

**Never log** query values, lead/patient names, emails, or phone numbers.

**Feeds S11:** when `legacy_route_hit` for a route stays at/near zero across a full clinic cycle and `target_denied` is negligible, promote that redirect to permanent (308) and retire the legacy page, component, and loader.

---

## 12. Tests

1. `/leadflow` → `/crm`. 2. `/consultation-conversion` → `/crm`. 3. Tenant ID preserved in target. 4. Safe query whitelist preserved (none → target has no query). 5. Unknown params dropped. 6. No redirect loop (target renders, does not re-redirect to legacy). 7. `/crm` does not redirect back to either legacy route. 8. Allowlisted tenant lands on `PipelineWorkspace`. 9. Non-allowlisted tenant lands on legacy `/crm` fallback. 10. Unauthorised user → canonical `/cases` behaviour (not a loop). 11. Platform-admin proxy still resolves `/crm`. 12. Read-only stays read-only on `/crm`. 13. Capability override still reaches `/crm`. 14. `/crm/leads/{id}` unchanged. 15. Today/search lead links unchanged (`/crm/leads/{id}`). 16. No unique workflow lost (parity table). 17. Active nav = Pipeline for `/leadflow`, `/consultation-conversion`, `/crm`. 18. Legacy pages no longer render `LeadFlowOperatorDashboard` / `ConsultationConversionBoard` after redirect. 19. Telemetry payload contains no PHI (IDs/counts/key-names only). 20. Production build passes.

Suggested file: `src/lib/crm/pipelineLegacyRedirects.test.ts` **only** if a helper is introduced (not recommended); otherwise add redirect assertions to the existing `pipelineCutover.s45d.test.ts` / a new `pipelineCutover.s45e.test.ts` that reads the two page files and asserts `redirect(` + `/crm` target and absence of the old dashboard imports.

---

## 13. File-level plan

**Edit (Commit S4.5E — redirects):**
- `app/(fi-admin)/fi-admin/[tenantId]/leadflow/page.tsx` → thin `redirect()` to `/crm`.
- `app/(fi-admin)/fi-admin/[tenantId]/consultation-conversion/page.tsx` → thin `redirect()` to `/crm`.

**Optional (only if justified — it is not):** `src/lib/crm/pipelineLegacyRedirects.ts` + `.test.ts`. **Skip** — no query whitelisting needed; the two-line `redirect()` is trivially testable by reading the page files.

**Proactive link update (may fold into S4.5E or a follow-up):** `src/lib/fiAdmin/consultationPresentation.ts` (5 hrefs `/consultation-conversion` → `/crm`) on active dashboards.

**Tests:** add `pipelineCutover.s45e.test.ts` (redirect assertions #1–#20 where statically checkable); update any test currently asserting the legacy pages render a dashboard.

**Docs:** update `docs/fi-ux-audit/01-route-inventory.md` (mark both routes "redirect → /crm (S4.5E)"); note in `docs/fi-ux-rebuild/*` completion.

**Do not delete** `LeadFlowOperatorDashboard`, `ConsultationConversionBoard`, `LeadFlowDashboard`, `loadLeadFlowOperatorDashboardPayload`, `loadConsultationConversionBoardPayload`, or `consultationConversionBoardLoader.server.ts` — retained until S11.

---

## 14. Rollback strategy

Redirects are **independently reversible** from the `/crm` route switch, nav consolidation, Pipeline loaders, and Pipeline presentation — they touch only the two legacy `page.tsx` files.

```
Rollback = revert the two redirect page edits (one commit)
```

- **No DB rollback** (nothing persisted).
- Legacy components and loaders remain in source, so reverting the two pages instantly restores the old dashboards.
- The redirect commit must **not** be squashed with S4.5A/S4.5C/S4.5D changes, so it can be reverted alone.

---

## 15. Final verdict

```
PASS WITH CONDITIONS
```

The redirects are safe by construction — both legacy loaders parse no query params (lossless drop-all), no unique workflow or mutation lives only on either route (zero `redirect_blocker`), loop-free for allowlisted/non-allowlisted/unauthorised, PIN behaviour unchanged, and access narrows only fail-safely for portal-only-non-CRM users on the retiring conversion board.

**Conditions before activating (merging) the redirects:**
1. **Live staff-credential mutation walkthrough passes on staging** (move stage, complete follow-up, mark lost, reopen, create enquiry, convert, book consultation) — until then, **PROCEED WITH REDIRECTS HELD** (author + test, don't activate).
2. **S4.5D terminology fix lands** ("Conversion board view" in the legacy `/crm` fallback) so redirected non-allowlisted users don't meet a prohibited term.
3. **Drop-all query** — no forwarding, no helper.
4. **Proactively update active-surface `/consultation-conversion` hrefs** in `consultationPresentation.ts` (or accept redirect-handling + `legacy_route_hit` telemetry); leave links inside retiring legacy components for S11.
5. **Keep the redirect commit isolated** for one-commit rollback; retain legacy components/loaders until S11.

---

## Conclusion

**1. Exact redirect table**

| Route | Target | Type (S4.5E) | Type (S11) | Query | Access after |
|---|---|---|---|---|---|
| `/fi-admin/{tenantId}/leadflow` | `/fi-admin/{tenantId}/crm` | temporary (307) | permanent (308) | none | CRM-shell (equivalent) |
| `/fi-admin/{tenantId}/consultation-conversion` | `/fi-admin/{tenantId}/crm` | temporary (307) | permanent (308) | none | CRM-shell (narrows from portal, fail-safe) |

**2. Query whitelist** — **drop all** on both routes; neither legacy loader consumes query params, so forwarding is lossless-to-omit and risk-only-to-include. No helper.

**3. Access behaviour** — `/leadflow`→`/crm` access-equivalent (CRM-shell both sides); `/consultation-conversion`→`/crm` narrows portal→CRM-shell (fail-safe: target gates, no expansion, no leakage; retiring read-only board); staff-PIN blocked on both before and after (no change); redirect pages carry **no** own gate (target authorises); unauthorised users terminate at `/cases`.

**4. Redirect-loop proof** — `/crm` (page + gate) never redirects to `/leadflow` or `/consultation-conversion`; its only redirect target is `/cases`, which does not cycle back; active-route maps are nav-highlight only; no middleware. Loop-free for allowlisted, non-allowlisted, and unauthorised.

**5. Inbound link impact** — no nav/lead/Today/search link points at either legacy route (S4.5D repointed nav; lead links are `/crm/leads/{id}`). Remaining `/consultation-conversion` hrefs: update `consultationPresentation.ts` proactively; leave retiring legacy-component links for S11 (redirect handles them); `staffPinPermissions` entry is a block-list, keep.

**6. Workflow parity result** — all workflows `preserved_directly` or `preserved_in_lead_workspace`; consultation triage covered by card `consultation` state + `booked_deposit` column + lead workspace; **zero `redirect_blocker`**.

**7. Operator mutation recommendation** — **PROCEED WITH REDIRECTS HELD**: land and test the redirect code, but do not activate until the live staff-credential mutation walkthrough passes on staging.

**8. Telemetry plan** — count legacy hits per route, redirect success/failure, forwarded key-names (expected none), target-denied (portal→CRM-shell narrowing), bookmark usage; no PHI; drives S11 permanent-redirect + component retirement when hits drain to ~0.

**9. Rollback boundary** — revert the two redirect `page.tsx` edits (one isolated commit); no DB rollback; legacy components/loaders retained until S11; independent of route switch/nav/loaders/presentation.

**10. Final go/no-go verdict** — **PASS WITH CONDITIONS**: redirects are structurally safe and reversible; activate only after (1) the staging mutation walkthrough passes, (2) the S4.5D terminology fix lands, with (3) drop-all query, (4) proactive active-surface link updates, and (5) an isolated redirect commit for clean rollback.
