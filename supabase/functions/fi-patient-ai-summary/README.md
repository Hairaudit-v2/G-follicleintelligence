# fi-patient-ai-summary

Edge Function **skeleton** for AI Patient Summary.

## Production path

Use the Next.js server action:

- `generatePatientAiSummaryAction` → `patientAiSummary.server.ts`
- SpaceXAI / xAI via `XAI_API_KEY`
- Cache: `fi_patient_ai_summary_cache`
- Audit: `fi_patient_ai_summary_logs`

## Why Edge is thin

Safety prompts, keyword guards, and fact builders live in the app so they can be unit-tested and cannot drift between Edge and Node.

## Dry run

```bash
curl -X POST "$SUPABASE_URL/functions/v1/fi-patient-ai-summary" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"<uuid>","patient_id":"<uuid>","dry_run":true}'
```
