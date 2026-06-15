# Data retention policy (intelligence logs, replay, and ecosystem artifacts)

**Document type:** Policy draft for governance and DBA review. **Suggested** retention classes below require **production review** and alignment with statutory / contractual minima before enforcement jobs or DDL are added.

**Activation:** Automated deletion, anonymisation jobs, or shortened retention **must not** run against production until this document is approved and backed by tickets / migrations.

---

## 1. Principles

- **Minimization:** retain the **smallest** set of fields and duration needed for security, audit, and operational debugging.
- **No raw clinical payloads** in intelligence event logs — retention applies to **metadata and summaries** only.
- **Separation:** clinical systems of record retain patient charts; this policy covers **intelligence bus** and **governance** artifacts in FI infrastructure unless otherwise stated.

---

## 2. `public.fi_intelligence_event_logs`

| Aspect | Guidance |
|--------|----------|
| **Content** | Append-only metadata, `payload_summary` (sanitized), warnings, non-PHI error summaries |
| **Suggested class** | **Operational security / audit** — shorter than clinical record retention unless legal requires longer for fraud / abuse investigation |
| **Deletion / anonymisation** | Partition or time-based purge of rows past retention; **do not** “anonymise” into another store without review |
| **Production note** | Application code **forces persistence off** when `NODE_ENV === "production"` today; enabling persistence in production is **out of scope** until governance sign-off and explicit policy stage |

---

## 3. `public.fi_intelligence_replay_runs`

| Aspect | Guidance |
|--------|----------|
| **Content** | Filters, mode, approval trail, counts, structured `summary`, operator identifiers |
| **Suggested class** | **Change management / internal audit** — retain long enough to prove who approved what; align with SOC2 / internal policy |
| **Deletion / anonymisation** | Redact `requested_by` / `approved_by` if personal emails are stored; prefer service accounts for automation after review |
| **Production note** | Table is additive; absence of rows does not imply absence of side effects — correlate with application logs |

---

## 4. IIOHR competency evidence records

| Aspect | Guidance |
|--------|----------|
| **System of record** | IIOHR or connected HR / LMS platforms |
| **FI copy** | If FI stores mirrors, retention follows **HR / employment law** and tenant contracts — **not** covered by intelligence log TTL alone |
| **Deletion** | Coordinate with IIOHR product owners; avoid orphan competency claims |

---

## 5. Professional graph snapshots

| Aspect | Guidance |
|--------|----------|
| **Content** | Pseudonymous graph nodes / edges for analytics (when enabled) |
| **Suggested class** | **Analytics** — often shorter TTL; refresh from authoritative staff directory |
| **Anonymisation** | Graph re-ID risk — use policy-approved k-anonymity or aggregation before long retention |

---

## 6. AuditOS shadow snapshots

| Aspect | Guidance |
|--------|----------|
| **Content** | In-memory or debug snapshots from shadow bus / queue paths (non-production by default) |
| **Suggested class** | **Ephemeral** — process lifetime unless explicitly persisted for a debug ticket |
| **Production** | Shadow enqueue is **hard-off** in production per Stage 12/14 policy |

---

## 7. Export audit tables

| Aspect | Guidance |
|--------|----------|
| **Purpose** | Prove **what** was exported, **when**, and **outcome** (`IntelligenceExportAttempt` patterns) |
| **Suggested class** | **Compliance** — often **long** retention; may be immutable append-only |
| **Deletion** | Typically **do not delete** until legal holds cleared; prefer archival to cold storage |

---

## 8. Suggested retention classes (summary)

| Class | Typical duration driver |
|-------|-------------------------|
| **Ephemeral** | Seconds–days; dev/test only |
| **Operational** | Weeks–months; incident response |
| **Audit / compliance** | Years; legal and regulatory |
| **Clinical record** | Governs source systems; **not** intelligence logs |

---

## 9. Deletion and anonymisation approach

1. **Inventory** — list tables and columns that can hold identifiers (emails in replay metadata, webhook URLs in config stores, etc.).
2. **Job design** — idempotent batch deletes; avoid table locks during peak; log purge counts.
3. **Verification** — spot-check that downstream caches and object storage do not retain duplicates.
4. **Documentation** — update runbooks when TTLs change.

---

## 10. Production review required

Any change to **default TTL**, **production persistence**, or **bulk purge** requires:

- DBA capacity review,
- Legal / privacy alignment,
- Rollback plan ([incident rollback checklist](./incident-rollback-checklist.md)).

Until then, **no automated production purges** for these artifacts should run from this document alone.
