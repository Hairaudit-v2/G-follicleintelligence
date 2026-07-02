# Conceptual Documentation — Deprecated (FI-UX-AUDIT-1)

**Date:** 2026-07-02  
**Action:** Moved to `docs/_archive/conceptual/` — not part of operator canon.

These documents described **planned** architecture, not deployed UI. They must not be used for staff training or UAT.

---

## Archived folders

| Folder | Files | Reason |
|--------|-------|--------|
| `docs/design/` | 38 | Pre-implementation specs, roadmaps, "conceptual architecture" |
| `docs/platform-architecture/` | 14 | Platform vision diagrams, not click-path guides |

---

## Other conceptual docs (remain in place — do not use for operators)

| Path | Classification |
|------|----------------|
| `docs/fi-os-outcome-intelligence-network-foundation.md` | Vision |
| `docs/ecosystem-architecture-stabilization-audit.md` | Engineering audit |
| `docs/ecosystem-source-system-taxonomy.md` | Taxonomy |
| `docs/imaging-os-architecture.md` | Technical contract |
| `docs/imaging-os-phase-im*.md` | Implementation phases |
| `docs/architecture/digital-twin-foundation-design.md` | Design |
| `docs/workforce/workforceos-v2-interface-redesign.md` | Redesign spec |
| `docs/workforce/workforceos-phase-1c-sprint-*.md` | Sprint notes |
| `docs/surgery/SURGERYOS_ARCHITECTURE_AUDIT_V1.md` | Architecture audit |
| `docs/audits/imagingos-strategic-audit.md` | Strategic audit |
| `docs/stage11–18*.md` | Internal bus / intelligence pipeline |
| `PROJECT_OVERVIEW.md`, `docs/AI_ARCHITECT_RULES.md` | Agent/dev rules |

---

## Operator canon (use instead)

1. **[05-operator-guide.md](./05-operator-guide.md)** — primary staff guide
2. **[01-route-inventory.md](./01-route-inventory.md)** — routes
3. **[02-ui-terminology-dictionary.md](./02-ui-terminology-dictionary.md)** — labels
4. **[03-workflow-maps.md](./03-workflow-maps.md)** — workflows
5. **[04-role-journeys.md](./04-role-journeys.md)** — role journeys
6. `docs/fi-os-real-clinic-uat-checklist.md` — UAT checklist
7. `docs/FI_OS_ENVIRONMENT_AND_PLATFORM_SETUP.md` — environment setup
8. In-app: `src/lib/fiOs/staffUatScreenGuide.ts`

---

## Engineering docs (keep, not for clinic staff)

- `docs/security/*`
- `docs/runbooks/fi-os-production-*` (deployment)
- `docs/testing/e2e-strategy.md`
- `docs/security/api-routes-inventory.md`

---

## Redirect stubs

Original `docs/design/README.md` and `docs/platform-architecture/README.md` replaced with pointers to this audit.