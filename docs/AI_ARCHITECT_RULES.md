\# FI OS Architectural Rules



Core Philosophy:

\- FI OS is the intelligence infrastructure for elective medicine.



System Boundaries:

\- HairAudit = external image intelligence producer

\- HLI = longevity intelligence producer

\- IIOHR = education intelligence producer

\- FI OS = central operating system



Non-negotiable Rules:

\- Never break multi-tenant isolation.

\- Never expose Supabase service\_role to client.

\- All webhook endpoints must be idempotent.

\- Never create direct table writes without audit logging.

\- All patient data requires traceability.



Database:

\- No schema changes without migration review.

\- Never delete columns without fallback compatibility.



UI:

\- Use shared packages/ui.

\- Never create isolated styling systems.

\- Dark/light contrast required.



Security:

\- All admin routes server protected.

\- All cron routes require secret verification.

