# A second tutor can act on the founder's login instead of having his own

Jason, the second tutor, will not authenticate as himself. He and the founder
share one Cognito login — deliberately, not as a stopgap forced by a missing
feature. The founder is short on time this semester and explicitly ruled out
provisioning Jason his own account "for now," calling that a later feature.

ADR-0001 already made tutor identity a dimension on existing records — a
`tutorSub` string keying availability, overrides, and sessions — rather than
requiring a real Cognito account behind every tutor. This ADR uses that
existing looseness: Jason gets a synthetic `tutorSub` (`SECOND_TUTOR_SUB`,
e.g. `"jason"`) that is a key into the data model and nothing else. No
Cognito user, no group membership, no way to authenticate as it directly.

## Acting as a tutor you didn't authenticate as

Whoever is signed in — founder or Jason, indistinguishable to Cognito — picks
which schedule they're editing via an "Acting as" switch on
`/tutor/schedule`, tracked in the URL (`?as=second`) so it's bookmarkable.
That choice is passed to the API as an untrusted `?tutorSub=` query param.

`resolveActingTutorSub()` (`src/lib/auth-helpers.ts`) is the one place that
turns that untrusted value into a tutor identity to read or write: it accepts
only the caller's own verified sub or the configured `SECOND_TUTOR_SUB`,
rejecting anything else with 403. `listTutors()` appends the second-tutor
identity after sorting the real Cognito tutors by account age, so it can
never land at index 0 — the "founder" position other logic (booking
overflow, Google Calendar freebusy in ADR-0008) depends on.

The second tutor's identity shares the founder's email for all session
correspondence (booking confirmations, cancellations) rather than getting
its own inbox — a deliberate scope cut, not an oversight. It does get its
own meeting-room URL, set through the same profile card as the founder's,
because a wrong Zoom link is an immediate failure a student hits directly.

## Booking assignment now prefers the founder, not the newer tutor

ADR-0002 assigned the newer tutor first specifically to move load off the
founder, treating him as overflow. That is reversed here: `chooseTutor()`
(`src/lib/booking-assignment.ts`) now prefers the founder on any slot he's
free for, falling back to the second tutor only for what the founder can't
cover. Continuity (the tutor who last taught a given household) still
outranks both.

This isn't a rejection of ADR-0002's goal — the founder is still trying to
shed hours — it's pursued by shrinking the *hours he offers* rather than by
losing ties on the hours he keeps. Within his own open hours he still wants
first pick; the second tutor absorbs everything outside them.

## Session-note attribution comes from the booking, not the note-taker

A session note logged for an existing scheduled booking (`sessionId` passed
to `POST /api/tutor/session-notes`) attaches to that booking in place —
`completeSessionWithNotes()` in `src/lib/dynamodb.ts` — and keeps that
booking's own `tutorSub`, already decided by `chooseTutor()` at booking time.
The `?tutorSub=`/acting-as mechanism above is consulted only for a note with
no underlying booking at all (a walk-in or make-up lesson never booked
through the pooled system), since there's no assignment to inherit.

This was the deliberate fix for a real gap: previously every note-taking
call created a brand-new `TutoringSession` row regardless of whether a
booking already existed for that lesson, so a taught, booked session and its
notes could end up as two disconnected records — and the notes row was
always attributed to whoever was signed in when it got typed up, not to
whoever the pooled system actually assigned. Tying notes to the booking
fixes both at once: one record per lesson, and correct-by-construction
per-tutor history, since attribution never depends on who happens to write
the note up afterward.

## Addendum (2026-09-22): the second tutor gets his own reminder inbox

The "shares the founder's email for all session correspondence" cut above
is partially reversed: the 1-hour-before session reminder Lambda
(`infrastructure/lambda/session-reminder`) now sends to a real `SECOND_TUTOR_EMAIL`
address for sessions with `tutorSub === SECOND_TUTOR_SUB`, instead of falling
through to the founder's inbox. `upsertTutorMeetingRoom`'s caller
(`/api/tutor/profile` PUT) writes that fixed address to the second tutor's
profile row rather than whichever founder-account email happens to be signed
in when acting as him.

Booking confirmations and cancellations (`src/lib/ses.ts`) are unchanged and
still go only to the founder's inbox — those never looked up a per-tutor
email to begin with, so widening this any further than reminders was out of
scope here.

## Considered Options

- **A second real Cognito account, added to the `tutors` group.** Rejected
  for now: this is exactly the setup labor ("no need for multiple tutor
  accounts for now") the founder is trying to avoid this semester. Nothing
  here forecloses it — migrating `WEEKLY#jason`/`OVERRIDE#jason#*` rows to a
  real sub later is the same kind of one-off script ADR-0001 already needed
  for the first tutor addition.
- **A DynamoDB-backed tutor-identity record instead of an env var constant.**
  Rejected: generalizes to a third tutor, which isn't the ask; an env var is
  strictly less to build and just as migratable later.

## Consequences

- Nothing stops the founder and Jason being signed in simultaneously from
  different devices, each editing a different "acting as" tab. Not handled —
  low likelihood, low cost if it happens (last write to a given day wins),
  not worth the complexity right now.
- Every route that writes tutor-scoped data (`/api/availability`,
  `/api/availability/overrides`, `/api/tutor/profile`) must run requests
  through `resolveActingTutorSub()`; a route that reads `user.sub` directly
  for a write instead would silently edit the wrong tutor's data whenever
  Jason is signed in.
- If `SECOND_TUTOR_SUB` is unset, every part of this feature is inert: the
  switcher doesn't render, `listTutors()` returns only real Cognito tutors,
  and `resolveActingTutorSub()` rejects anything but the caller's own sub —
  the app behaves exactly as it did with one tutor.
