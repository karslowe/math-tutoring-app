# Tutor identity is a dimension on existing records, not a new subsystem

The portal was written for exactly one tutor: availability was stored under a
single global key, every session was implicitly taught by the owner, and a slot
lock made one start time exclusive across the whole system. Adding a second
tutor is therefore a widening of existing records — availability and overrides
become per-tutor, sessions carry the tutor who taught them, and the slot lock
becomes per-tutor — rather than a new scheduling service.

## Consequences

- Two tutors can hold sessions at the same start time. Under the old global slot
  lock they could not, which was the single hard blocker on a second tutor.
- Existing availability rows and every historical session must be migrated to
  the founding tutor by a one-off script. Sessions have no tutor recorded, so
  the backfill is an assertion, not a derivation — it is only correct because
  one person taught all of them.
- Tutor-specific fields (photo, bio, meeting room, calendar credentials) hang off
  the existing user profile where the role is tutor. There is no separate tutor
  table.

## Amendment (2026-09-19)

This looseness — a `tutorSub` string is just a key, not necessarily a real
Cognito account — turned out to matter for reasons beyond migration
convenience: ADR-0009 gives a second tutor a synthetic `tutorSub` with no
Cognito account behind it at all, so he can share the founder's login instead
of needing his own.
