# FI UI review — shared design system candidates

Documentation only. No application code changes; no new components. Source: cross-surface review of fi-admin, CRM, patients, cases, Hair Audit, system status (HLI / IIOHR inventory), and OS login.

---

## 1. Scope note

### HLI and IIOHR

There are **no dedicated App Router pages** for standalone HLI or IIOHR product UIs. They appear in **copy** (e.g. patient directory prose) and in **System status** via the central feature registry (IIOHR is marked “planned” in that inventory). The main grouped UI for “HLI / IIOHR” today is **System status** (`SystemStatusPage` and related components).

### Hair Audit

- **`/hair-audit/admin`** — Standalone OS administrator hub (`app/hair-audit/admin/page.tsx`): dark slate background, **emerald** accent, tenant list links into FI admin audit routes.
- **Tenant audit queue** — **`/fi-admin/[tenantId]/audit`** (`app/(fi-admin)/fi-admin/[tenantId]/audit/page.tsx`): minimal client page (gray bordered table, simple loading copy). Inherits parent FI admin layout chrome.

### Login

- **`/follicle-intelligence/login`** — Renders `FiOsLoginScreen` (shared OS sign-in surface).

### fi-design vs production usage

`src/components/fi-design/` defines **`FiCard`**, **`FiSection`**, **`FiPageHeader`**, and **`FiQuickActionCard`**. At review time these had **no consumers outside their own files** — they are a **nascent** layer, not yet wired into tenant routes.

---

## 2. Card patterns

| Pattern | Where it appears | Notes |
|--------|------------------|--------|
| **Dark glass panel** | `DashboardCard`, `QuickActionCard`, `StatCard`; `FiHomeDashboard`; cases worklist empty/filter messages (`CasesWorklistView`) | `border-white/[0.08]`, `#0F1629` / `#141C33`, cyan `#22C1FF` accents |
| **Light “Clinic OS” panel** | `ClinicOsDashboardHome` (inline `rounded-2xl border border-slate-200 bg-white`); `FiCard` / `FiSection` (fi-design) | White + `slate-*`, `shadow-sm` |
| **Light “CRM gray” panel** | CRM index, patient directory, system status sections | `border-gray-200 bg-white`; **radius** varies (`rounded` vs `rounded-lg` vs `rounded-2xl`) |
| **HairAudit console** | `app/hair-audit/admin/page.tsx` | Dark slate + emerald; `backdrop-blur` |
| **Audit queue** | `audit/page.tsx` | Plain **HTML table** with gray borders — lowest-level pattern |

**Duplication:** `ClinicOsDashboardHome` defines **`MainActionCard`**, **`SnapshotCard`**, and a welcome **section** that overlap the responsibilities of **`FiQuickActionCard`**, **`FiPageHeader`**, and **`FiSection`** with slightly different class strings.

**Consolidation target:** A small set of **`Surface` / `Card` variants** (e.g. `osGlass`, `clinicLight`, `documentGray`, `portalDark`) backed by shared tokens, with domain pages composing on top — not one visual style for everything.

---

## 3. Badge / status styles

Several **parallel implementations** cover similar semantics (success / warning / danger / neutral):

| Component / area | Style mechanism |
|------------------|-----------------|
| **`CaseSectionHealthBadge`** | Bordered pills; `emerald` / `amber` / `rose` / `gray` |
| **`PatientStatusBadge`** | `ring-1 ring-inset`, `rounded-full` |
| **`SystemStatusBadge`** | Same **ring-inset** pattern as patient badges; traffic-light colors |
| **`FiHomeDashboard` `StatusPill`** | Larger pill with **ping animation** and glow — unique to legacy tenant home |
| **“Coming soon” / neutral chips** | Repeated in `FiQuickActionCard`, `ClinicOsDashboardHome` `MainActionCard`, `ClinicOsShell` dropdown rows |
| **System status “Planned”** | Inline `span` when no traffic light maps |

**Design-system direction:** One **semantic API** (e.g. `intent: success | warning | danger | neutral | info` + `density: compact | default`) mapping case readiness, patient status, traffic lights, and marketing pills to a **single token set**.

---

## 4. Page headers

At least **four header dialects**:

1. **`FiPageHeader`** (fi-design) — Eyebrow, large title, description, primary/secondary action slots. **Not used** by routes at review time.
2. **`ClinicOsDashboardHome` welcome block** — Same **information architecture** as `FiPageHeader` but hand-rolled (`text-sky-700` eyebrow, `text-xl` title).
3. **“Gray document” headers** — CRM, patients, system status, case detail: `text-lg font-semibold text-gray-900` + `text-sm text-gray-600` + `text-blue-600` back links.
4. **Portal / marketing headers** — `FiOsLoginScreen`, HairAudit admin: wide letter-spacing uppercase, large white titles, gradient backgrounds.

Unifying does **not** require one visual; it means **shared primitives** (e.g. `PageHeader` with `variant: "osDark" | "clinicLight" | "portal"`) for spacing, type scale, and action alignment.

---

## 5. Shell / sidebar / header differences

| Surface | Role |
|--------|------|
| **`DashboardShell`** | Used by **`app/(fi-admin)/layout.tsx`**: full-viewport **navy OS** background, FI Admin picker header, sign out. |
| **`FiTenantBrandFrame` + `FiAdminTenantNav`** | When **`NEXT_PUBLIC_FI_CLINIC_OS_SHELL` ≠ `"true"`**: brand frame + horizontal tenant nav. Tenant **`layout.tsx`** wraps page children in a **dark glass `mainSurface`** inset. |
| **`ClinicOsShell`** | When flag is **`"true"`**: **light** `bg-slate-50`, **white sticky header**, Cmd+K global search, horizontal **nav pills**, “New” dropdown, optional calendar bar. |

**Visual tension:** With Clinic OS enabled, the shell is **light** outside, while **`app/(fi-admin)/fi-admin/[tenantId]/layout.tsx`** still places children inside the **dark bordered `mainSurface`**. That reads as a **two-theme stack** compared to CRM/patients pages that are mostly **gray-on-white** inside the same inset. Document as a **content chrome** decision: when the inset is “stage” vs when body should be full-bleed light.

---

## 6. Buttons, inputs, search

- **`components/ui/button.tsx`**: shadcn **CVA** variants exist, but many surfaces use **raw `<button>` / `<Link>`** with long Tailwind strings (FI home CTA, Clinic OS primary/secondary, CRM filter Apply, case CTAs, HairAudit text links).
- **Filter forms** (patients, cases): Shared ad-hoc pattern — `rounded border border-gray-300 bg-white`, small gray labels; **no** shared `Input` component was present at review (no `components/ui/input.tsx`).
- **Global search:** **`ClinicOsGlobalSearch`** — shell-level dialog + trigger; separate from worklist filter search fields.
- **Login:** **`FiOsLoginScreen`** — dark inputs, cyan focus rings; alert blocks similar in *role* to **`InfoNotice`** but different markup.

**Design-system direction:** `Button` variants covering OS gradient primary, Clinic sky primary, neutral gray secondary, ghost/link; optional **`TextField` / `SelectField`** wrappers for filter bars **without** changing `action`, `method`, or `name` attributes on forms.

---

## 7. Dashboard visual inconsistencies

- **Two tenant home experiences** — `app/(fi-admin)/fi-admin/[tenantId]/page.tsx` switches on **`NEXT_PUBLIC_FI_CLINIC_OS_SHELL`**: **`ClinicOsDashboardHome`** (light, placeholder metrics, white cards) vs **`FiHomeDashboard`** (dark glass, real setup payload, `StatCard` / `QuickActionCard` / `SectionHeader`). Flipping the flag changes **product personality**, not only chrome.
- **CRM / patients / system status** align with each other (gray headings, blue links) but **diverge** from OS-glass home and from **Clinic OS** light patterns inside the same app.
- **Audit queue** reads as an **internal fragment** (minimal header, bordered table) next to polished shell-backed routes.

---

## 8. Files / components to reuse

Prefer **extending** these rather than replacing or deleting them:

| Area | Path / names |
|------|----------------|
| OS glass dashboard kit | `src/components/fi-admin/dashboard-ui/*` — `DashboardCard`, `SectionHeader`, `StatCard`, `QuickActionCard`, `InfoNotice`, `ProgressChecklist`, `DashboardShell`, `dashboardTheme` / `fiAdminAmbientBackgroundStyle` |
| Light Clinic primitives | `src/components/fi-design/*` — `FiCard`, `FiSection`, `FiPageHeader`, `FiQuickActionCard` (wire consumers over time) |
| Shells & nav | `FiTenantBrandFrame`, `FiAdminTenantNav`, `ClinicOsShell`, `ClinicOsShellCalendarBar`, `ClinicOsGlobalSearch` |
| Domain badges | `CaseSectionHealthBadge`, `PatientStatusBadge`, `SystemStatusBadge` — refactor **internals** to shared tokens; keep **public props** stable |
| Auth surface | `FiOsLoginScreen` |
| System status composition | `SystemStatusPage`, `SystemStatusSection`, `SystemStatusCard`, `SystemStatusMetric` |

---

## 9. Safe migration order

Constraints: **do not break routes**, **do not remove existing components**, **do not change database, auth, RLS, loaders, or server actions**. UI-only sequencing:

1. **Tokens + documentation** — Centralize colors, radius, spacing in theme or shared constants; **no** call-site changes.
2. **Internals of existing components** — Implement shared tokens inside `InfoNotice`, dashboard cards, etc.; preserve external API and visual intent (verify with snapshots or manual QA).
3. **Clinic OS dashboard** — Deduplicate welcome / quick-action / “Coming soon” chips toward shared primitives; **unchanged** `href`s and DOM semantics where possible.
4. **Gray module headers** — Thin wrapper for CRM / patients / cases / system status header + back-link row; same URLs and copy.
5. **Filter toolbars** — Shared layout/field styling; preserve GET forms and query param names.
6. **Badges** — Introduce a base `Badge`; keep `CaseSectionHealthBadge` etc. as thin facades during transition.
7. **HairAudit + audit queue** — Polish last (lowest traffic, most visually isolated); no API contract changes.

**Compatibility tactic:** Re-export legacy names from new modules if needed; add **`variant`** props instead of deleting `DashboardCard` or `QuickActionCard`.

---

## 10. Summary table

| Area | Primary inconsistency | Design-system lever |
|------|------------------------|---------------------|
| Cards | Dark glass vs white slate vs gray CRM vs HairAudit dark | `Surface` / `Card` variants + tokens |
| Badges | Border vs ring vs glow pill | Semantic `Badge` + density |
| Headers | `FiPageHeader` unused vs several hand-rolled patterns | `PageHeader` variants |
| Shell | OS navy vs dark inset vs Clinic light header | Document chrome levels; optional full-bleed light body |
| Controls | shadcn `Button` vs long custom classes | `Button` + field primitives |
| Dashboards | Two tenant homes by feature flag | Align metrics placement and tone over time |

---

## Related internal docs

- `docs/design/19-fi-os-current-state-and-dashboard-roadmap.md` — routes, gates, and dashboard roadmap context.
