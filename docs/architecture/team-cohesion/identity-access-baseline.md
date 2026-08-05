# Raw identity access baseline

**Purpose:** Reproducible count of direct `fi_staff` / `fi_staff_members` references for Phase B1/C. Not limited to the three legacy directories.

**Regenerate:** `node scripts/team-cohesion/generate-b0-inventory.mjs`  
**Data:** `generated/b0-inventory.json` → `identityBaseline`

## Method

- Scan roots: `src/`, `scripts/`, `supabase/` (excluding `.worktrees`, `node_modules`, and `scripts/team-cohesion` generator source)
- Count word-boundary matches: `\bfi_staff_members\b` and `\bfi_staff\b`
- `fi_staff` counts are exclusive of `fi_staff_members` tokens (the members form is counted only under members)
- Each file×table pair is classified heuristically (see generator `classifyIdentityHit`)

This method differs from the Aug 2026 audit’s “448 refs / 176 files in `src/lib`”. Use **this regenerate** as the B0 baseline going forward; do not chase the historical 448 without matching that audit’s script.

## Headline counts (2026-08-05)

| Scope | `fi_staff` | `fi_staff_members` | Total | Files |
|-------|----------:|-------------------:|------:|------:|
| All scanned roots | 362 | 233 | **595** | 251 |
| `src/lib` only (audit parity slice) | 225 | 127 | **352** | 173 |

## Classification of references (all scanned)

| Classification | Refs |
|----------------|-----:|
| migration script | 224 |
| scheduling read | 91 |
| test or fixture | 88 |
| lifecycle read | 59 |
| cross-domain join | 46 |
| canonical identity resolution | 42 |
| suspected duplicate identity logic | 36 |
| reporting | 8 |
| mutation | 1* |

\*Mutation classification is under-counted by path heuristics; many write paths are labelled lifecycle/canonical today. Prefer inventory `mutationBearing` on team files plus manual review for write sites.

## Top areas by reference volume

| Area | `fi_staff` | `fi_staff_members` |
|------|----------:|-------------------:|
| `supabase/migrations` | 73 | 73 |
| `src/lib/workforce` | 30 | 71 |
| `src/lib/workforce-os` | 18 | 27 |
| `src/lib/staff` | 23 | 2 |
| `src/lib/staffImport` | 19 | 11 |
| `src/lib/fiOs` | 12 | 10 |
| `src/components` | 18 | 1 |
| `src/lib/integrations` (HubSpot owner mapping, etc.) | 17 | 0 |
| `src/lib/crm` | 12 | 4 |
| `src/lib/bookings` | 11 | 0 |
| `src/lib/calendar` | 11 | 0 |
| `src/lib/clinicSetup` | 10 | 0 |
| `src/lib/staffAccess` | 7 | 2 |

Cross-domain leak confirmed: bookings, CRM, calendar, financial/clinic setup, HubSpot import, fiOs hydration — not only Team lib.

## Baseline for B1 vs C

| Phase | Goal vs this baseline |
|-------|------------------------|
| **B1** | GREEN — `team/identity` API + profile hub proof + frozen dual-table allowlist / static test. |
| **B1.1** | GREEN — directory uses batch resolver; allowlist 25 → 24 (directory loader removed). |
| **B1.2** | GREEN — access centre uses batch resolver; allowlist 24 → 23 (access centre removed). |
| **B1.3** | GREEN — onboarding uses batch resolver; allowlist 23 → 22 (onboarding page loader removed). |
| **B1.4** | GREEN — roster eligibility uses batch resolver; allowlist 22 → 21 (lifecycle classifier removed). |
| **B1.5** | GREEN — credentials/compliance use batch resolver; allowlist 21 → 20 (HR task-map classifier removed). |
| **C** | Drive down `suspected duplicate identity logic` + `cross-domain join` classifications; opportunistic migration when files are touched. |

Track progress by re-running the generator and diffing `identityBaseline.srcLibOnly` and `byClassification`.
