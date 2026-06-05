# Reminder job processor (Supabase Edge Function)

The production app processes due rows via **Next.js** `POST` or `GET` **`/api/cron/fi-reminder-jobs`** with header `Authorization: Bearer <FI_REMINDER_CRON_SECRET>` (see `src/lib/reminders/reminderProcessor.server.ts`).

To run the same logic from Supabase Edge Functions later, invoke that HTTP endpoint from a scheduled Edge Function or call the shared processor by porting `processReminderJobsOnce` into Deno with a service-role Supabase client.
