# FI-CALENDAR-PATIENT-LINK-1A — Google Event Patient Hydration and Linking

## Evidence screenshot (retained)

`docs/audits/calendar-patient-link/fi-calendar-patient-link-1a-michael-berry-google-event.png`

## Source Google event (2026-08-06, support@follicleintelligence.ai)

- Title: Michael Berry
- Time: 4:00–4:30pm Thu 6 Aug 2026
- Location: South Perth Evolved Surgery
- Guest: m.berry2011@hotmail.com (Yes)
- Description:
  - Michael Berry - Follow-Up Consultation with Paul Green [Pending]
  - SMS: 421412307
  - Email: m.berry2011@hotmail.com
  - Location: South Perth Evolved Surgery
- Calendar (clinic, not patient): support@follicleintelligence.ai
- Created by: Paul Green

## Acceptance

1. Drawer shows Michael Berry + email + type + location + phone before linking.
2. Link patient finds / creates Michael Berry without UUID paste.
3. Confirm persists patient UUID; reopen + reload remain linked.
4. Reopen does not create a duplicate patient.
5. Google event id + calendar id preserved; classification `google_linked_fios` after link.

## Fixture constants

`src/lib/calendar/calendarPatientLink1aFixture.ts`
