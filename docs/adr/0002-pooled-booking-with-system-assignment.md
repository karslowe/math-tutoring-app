# Students book a time, and the system assigns the tutor

A Student picks a start time from the union of both Tutors' availability and
never chooses a Tutor. The system assigns one at booking time, preferring the
Tutor who last taught that Student and falling back to the newer Tutor. This
keeps booking to a single decision for the Student while leaving the split under
the practice's control.

## Considered Options

- **Students pick their tutor from photos.** Rejected: every current Student has
  an existing relationship with the founding tutor and would pick him, so the
  load would not move.
- **Assigned rosters, one primary tutor per student.** Rejected: it gives the
  strongest continuity but halves each Student's bookable hours, which works
  against the reason for adding a tutor in the first place.

## Consequences

- Continuity is a preference, not a guarantee. A Tutor can be assigned a Student
  they have never taught, which is what makes the Prep Card (ADR-0007) load
  bearing rather than a convenience.
- Tutor photos are informational — on the confirmation and the public page —
  rather than a booking control.

## Amendment (2026-09-19)

"Falling back to the newer Tutor" is reversed by ADR-0009: assignment now
prefers the founder on any slot he's free for, with the newer/second tutor
picking up only what he can't cover. The founder is still shedding load, but
by shrinking which hours he offers rather than by losing ties on the hours he
keeps open. Continuity still outranks this in both directions.
