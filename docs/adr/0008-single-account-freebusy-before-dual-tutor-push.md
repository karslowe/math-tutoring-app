# Calendar sync ships against one account first; ADR-0005's per-tutor plan is deferred

Google Calendar sync (freebusy filtering + one-way push of bookings) is built
against a single consolidated personal account, `karslowe0@gmail.com`, rather
than the two-independent-accounts design [ADR-0005](0005-google-calendar-oauth-with-ics-fallback.md)
recorded for the two-tutor expansion. This supersedes 0005 **for now** — not
permanently.

## Why

The founder needs visibility into his own real schedule (classes, RA duty,
club meetings) immediately, so students stop being offered slots he can't
honor and so booked sessions show up somewhere he'll actually see them. That
is achievable this week by consolidating his own calendars under one account
and building against it. Building the full per-tutor OAuth design from
ADR-0005 — a second, independent authorization for the second tutor — is
real, separate work that hasn't happened yet and isn't the constraint being
solved right now.

## What changes from ADR-0005

- **Freebusy filtering is in scope**, not deferred: `freebusy.query` against
  every calendar on `karslowe0@gmail.com` (enumerated via `calendarList.list`,
  not hardcoded) suppresses booking slots that overlap the founder's other
  commitments, with a 15-minute buffer on each side.
- **Only the founder's calendars are checked.** The founder tutor is
  identified as `tutors[0]` from `listTutors()` (oldest account first — the
  same "founder" convention `chooseTutor()` already uses in
  `/api/bookings`), not a new hardcoded identity. The second tutor's
  schedule is not checked against anything; his bookings are unaffected by
  this feature.
- **Every booking is pushed to the Tutoring calendar**, regardless of which
  tutor is assigned — the goal is one place to see the whole business's
  schedule, not a per-tutor calendar each.
- **ICS attachments remain unbuilt** (ADR-0005 called for these; they were
  never implemented). Not addressed here — orthogonal to this change.

## Consequences

- If a booking is assigned to the second tutor, it still lands on the
  founder's personal Tutoring calendar. That's intentional for now (a shared
  dashboard), but it means the calendar is not "the founder's calendar" in a
  literal sense once there's real volume on the second tutor.
- Reverting to ADR-0005's per-tutor design later means: a second OAuth
  authorization (the second tutor's own account), splitting `freebusy` checks
  and event pushes by assigned tutor instead of always targeting one
  account/calendar, and revisiting where the refresh token(s) live (this
  round used a single Secrets Manager secret; two tutors likely means two
  secrets or one secret holding both).
- Phase 0 (moving the founder's calendars onto `karslowe0@gmail.com`) is a
  manual, one-time migration outside this codebase.
