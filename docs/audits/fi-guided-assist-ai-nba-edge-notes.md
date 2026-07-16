# Clinic guide — AI Next Best Action (Edge Function notes)

**Status:** Prepared for future enablement. **Rule-based NBA is live** via `getRuleBasedNextBestActions` / catalog `isNextBestAction` tips. AI path is **not** called in production until explicitly enabled.

## Goals

- Return 1–2 **operational** “next best action” suggestions for Today (and optionally Pipeline / Front desk).
- Never diagnose, prescribe, interpret pathology, or give patient-specific medical advice.
- Always log suggestion source (`ai_nba`) and mark UI with **AI suggestion** badge.

## Recommended Edge Function

- **Name:** `guided-assist-next-best-action` (Supabase Edge Function)
- **Auth:** JWT + tenant membership check (same pattern as other FI tenant functions)
- **Input (minimal, non-PHI):**

```json
{
  "tenantId": "uuid",
  "role": "reception|consultant|doctor|finance|admin|all",
  "experienceLevel": "novice|intermediate|advanced",
  "pageKey": "",
  "timeOfDay": "morning|afternoon|evening|any",
  "stats": {
    "openLeadCount": 12,
    "todayBookingCount": 8,
    "openTaskCount": 3,
    "openSurgeryCaseCount": 1,
    "paymentRecordCount": 40
  },
  "approvedTipCodes": ["nba_high_leads_work_pipeline", "nba_evening_close_money"]
}
```

Do **not** pass patient names, clinical notes, photos, or free-text medical content.

## Output contract

```json
{
  "suggestions": [
    {
      "code": "nba_high_leads_work_pipeline",
      "title": "…",
      "body": "…",
      "actionLabel": "Open Pipeline",
      "actionHrefSuffix": "crm"
    }
  ],
  "model": "grok-…|gpt-…",
  "operationalOnly": true
}
```

Server must:

1. Restrict `code` to catalog tips where `isNextBestAction === true` (or a fixed allow-list).
2. Run `tipBodyIsOperationallySafe(body)` (reject clinical language patterns).
3. Cap at 2 suggestions.
4. Set `suggestionSource: "ai_nba"` and `isNextBestAction: true` on the tip view.
5. Log `fi_guided_assist_events` with `detail: { suggestionSource: "ai_nba", operationalOnly: true, model }`.

## Integration point

In `buildGuidedAssistSessionPayload` (or `loadGuidedAssistSessionPayload`):

1. Compute rule-based NBA first (always).
2. If `process.env.GUIDED_ASSIST_AI_NBA_ENABLED === "true"`, call Edge Function with timeout (~800ms).
3. On success, replace or append (dedupe by code) with AI tips **only** after safety filter.
4. On failure/timeout, keep rule-based tips silently.

## UI

`GuidedAssistWidget` already renders:

- **Next best action** badge for `rule_nba`
- **AI suggestion** badge for `ai_nba`
- Operational-only disclaimer above NBA list

## Safety copy (required)

Any AI tip body/title must remain compatible with:

> Clinic guide shows operational setup and day-of steps only. It does not give clinical advice or patient-specific treatment recommendations.

Reject and drop tips matching: diagnose / prescribe / dosage / treatment plan / medical advice / pathology interpretation.
